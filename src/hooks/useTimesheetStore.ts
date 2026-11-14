import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  User,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  createSecondaryAuthUser,
  db,
  handleFirestoreError,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  AccessProfile,
  Company,
  CustomHoliday,
  DayOverrideEntry,
  Employee,
  FIELD_LIMITS,
  MonthOverride,
  Schedule,
  TeamUser,
  UserAccessLink,
} from '../types/timesheet';
import { ALL_PERMISSION_KEYS, PermissionKey } from '../constants/permissions';
import { BillingCycle, PlanId } from '../constants/plans';
import {
  importBackupBundlesToFirestore,
  runUserMigrations,
} from '../services/migrations';
import { NormalizedEmployeeRow } from '../utils/employeeSpreadsheet';

export interface UserSubscriptionData {
  planId: PlanId;
  billingCycle: BillingCycle;
}

const PENDING_PLAN_STORAGE_KEY = 'pontorural_pending_plan';

function sanitizeString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function useTimesheetStore() {
  const [user, setUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [connectionWarning, setConnectionWarning] = useState(false);

  const [workspaceOwnerId, setWorkspaceOwnerId] = useState<string>('');
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState<boolean>(true);
  const [accessLink, setAccessLink] = useState<UserAccessLink | null>(null);
  const [assignedProfile, setAssignedProfile] = useState<AccessProfile | null>(null);
  const [accessDeniedInactive, setAccessDeniedInactive] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);
  const [monthOverrides, setMonthOverrides] = useState<MonthOverride[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [accessProfiles, setAccessProfiles] = useState<AccessProfile[]>([]);
  const [subscription, setSubscription] = useState<UserSubscriptionData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  useEffect(() => {
    testFirestoreConnection().then((ok) => {
      if (!ok) setConnectionWarning(true);
    });

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setEmailVerified(Boolean(firebaseUser?.emailVerified));
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !emailVerified) {
      setWorkspaceOwnerId('');
      setIsWorkspaceOwner(true);
      setAccessLink(null);
      setAssignedProfile(null);
      setAccessDeniedInactive(false);
      setCompanies([]);
      setSchedules([]);
      setEmployees([]);
      setCustomHolidays([]);
      setMonthOverrides([]);
      setTeamUsers([]);
      setAccessProfiles([]);
      setSubscription(null);
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    const unsubs: Array<() => void> = [];
    const dataUnsubs: Array<() => void> = [];
    const clearDataUnsubs = () => {
      while (dataUnsubs.length > 0) {
        const fn = dataUnsubs.pop();
        if (fn) fn();
      }
    };

    setDataLoading(true);
    const currentUid = user.uid;

    const startSync = async () => {
      try {
        const tokenResult = await user.getIdTokenResult(true);
        if (cancelled) return;
        if (!tokenResult.claims.email_verified) {
          setEmailVerified(false);
          setDataLoading(false);
          return;
        }
      } catch (err) {
        console.error('Token refresh error:', err);
        if (!cancelled) setDataLoading(false);
        return;
      }

      const linkPath = `userAccessLinks/${currentUid}`;
      let initialLink: UserAccessLink | null = null;
      try {
        const linkSnap = await getDoc(doc(db, linkPath));
        if (linkSnap.exists()) {
          initialLink = linkSnap.data() as UserAccessLink;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, linkPath);
      }
      if (cancelled) return;

      // Case 1: Workspace Owner
      if (!initialLink || initialLink.ownerId === currentUid) {
        setWorkspaceOwnerId(currentUid);
        setIsWorkspaceOwner(true);
        setAccessLink(null);
        setAssignedProfile(null);
        setAccessDeniedInactive(false);

        try {
          await runUserMigrations(currentUid);
        } catch (err) {
          console.error('Migration runner error:', err);
        }
        if (cancelled) return;

        const loadedFlags = {
          companies: false,
          schedules: false,
          employees: false,
          holidays: false,
          overrides: false,
          teamUsers: false,
          accessProfiles: false,
          subscription: false,
        };
        const checkDone = () => {
          if (
            !cancelled &&
            loadedFlags.companies &&
            loadedFlags.schedules &&
            loadedFlags.employees &&
            loadedFlags.holidays &&
            loadedFlags.overrides &&
            loadedFlags.teamUsers &&
            loadedFlags.accessProfiles &&
            loadedFlags.subscription
          ) {
            setDataLoading(false);
          }
        };

        const companiesPath = `users/${currentUid}/companies`;
        unsubs.push(
          onSnapshot(
            query(collection(db, companiesPath), where('ownerId', '==', currentUid)),
            (snap) => {
              const list = snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<Company, 'id'>) }))
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
              setCompanies(list);
              loadedFlags.companies = true;
              checkDone();
            },
            (error) => handleFirestoreError(error, OperationType.GET, companiesPath)
          )
        );

        const schedulesPath = `users/${currentUid}/schedules`;
        unsubs.push(
          onSnapshot(
            query(collection(db, schedulesPath), where('ownerId', '==', currentUid)),
            (snap) => {
              const list = snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<Schedule, 'id'>) }))
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
              setSchedules(list);
              loadedFlags.schedules = true;
              checkDone();
            },
            (error) => handleFirestoreError(error, OperationType.GET, schedulesPath)
          )
        );

        const employeesPath = `users/${currentUid}/employees`;
        unsubs.push(
          onSnapshot(
            query(collection(db, employeesPath), where('ownerId', '==', currentUid)),
            (snap) => {
              const list = snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, 'id'>) }))
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
              setEmployees(list);
              loadedFlags.employees = true;
              checkDone();
            },
            (error) => handleFirestoreError(error, OperationType.GET, employeesPath)
          )
        );

        const holidaysPath = `users/${currentUid}/customHolidays`;
        unsubs.push(
          onSnapshot(
            query(collection(db, holidaysPath), where('ownerId', '==', currentUid)),
            (snap) => {
              const list = snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<CustomHoliday, 'id'>) }))
                .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
              setCustomHolidays(list);
              loadedFlags.holidays = true;
              checkDone();
            },
            (error) => handleFirestoreError(error, OperationType.GET, holidaysPath)
          )
        );

        const overridesPath = `users/${currentUid}/monthOverrides`;
        unsubs.push(
          onSnapshot(
            query(collection(db, overridesPath), where('ownerId', '==', currentUid)),
            (snap) => {
              const list = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<MonthOverride, 'id'>),
              }));
              setMonthOverrides(list);
              loadedFlags.overrides = true;
              checkDone();
            },
            (error) => handleFirestoreError(error, OperationType.GET, overridesPath)
          )
        );

        const teamUsersPath = `users/${currentUid}/teamUsers`;
        unsubs.push(
          onSnapshot(
            query(collection(db, teamUsersPath), where('ownerId', '==', currentUid)),
            (snap) => {
              const list = snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<TeamUser, 'id'>) }))
                .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
              setTeamUsers(list);
              loadedFlags.teamUsers = true;
              checkDone();
            },
            (error) => handleFirestoreError(error, OperationType.GET, teamUsersPath)
          )
        );

        const profilesPath = `users/${currentUid}/accessProfiles`;
        unsubs.push(
          onSnapshot(
            query(collection(db, profilesPath), where('ownerId', '==', currentUid)),
            (snap) => {
              const list = snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<AccessProfile, 'id'>) }))
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
              setAccessProfiles(list);
              loadedFlags.accessProfiles = true;
              checkDone();
            },
            (error) => handleFirestoreError(error, OperationType.GET, profilesPath)
          )
        );

        const subDocPath = `users/${currentUid}/subscriptions/current`;
        unsubs.push(
          onSnapshot(
            doc(db, subDocPath),
            (snap) => {
              if (snap.exists()) {
                const data = snap.data() as { planId?: PlanId; billingCycle?: BillingCycle };
                if (data.planId && data.billingCycle) {
                  setSubscription({ planId: data.planId, billingCycle: data.billingCycle });
                  localStorage.removeItem(PENDING_PLAN_STORAGE_KEY);
                }
              }
              loadedFlags.subscription = true;
              checkDone();
            },
            (error) => handleFirestoreError(error, OperationType.GET, subDocPath)
          )
        );
        return;
      }

      // Case 2: Linked Sub-User (Team User)
      const ownerUid = initialLink.ownerId;
      setWorkspaceOwnerId(ownerUid);
      setIsWorkspaceOwner(false);

      const subscribeScopedWorkspace = (link: UserAccessLink) => {
        clearDataUnsubs();
        if (!link.active) {
          setAccessDeniedInactive(true);
          setCompanies([]);
          setSchedules([]);
          setEmployees([]);
          setCustomHolidays([]);
          setMonthOverrides([]);
          setDataLoading(false);
          return;
        }
        setAccessDeniedInactive(false);

        const profilePath = `users/${ownerUid}/accessProfiles/${link.profileId}`;
        dataUnsubs.push(
          onSnapshot(
            doc(db, profilePath),
            (snap) => {
              if (snap.exists()) {
                setAssignedProfile({
                  id: snap.id,
                  ...(snap.data() as Omit<AccessProfile, 'id'>),
                });
              } else {
                setAssignedProfile(null);
              }
            },
            (error) => handleFirestoreError(error, OperationType.GET, profilePath)
          )
        );

        const subDocPath = `users/${ownerUid}/subscriptions/current`;
        dataUnsubs.push(
          onSnapshot(
            doc(db, subDocPath),
            (snap) => {
              if (snap.exists()) {
                const data = snap.data() as { planId?: PlanId; billingCycle?: BillingCycle };
                if (data.planId && data.billingCycle) {
                  setSubscription({ planId: data.planId, billingCycle: data.billingCycle });
                }
              }
            },
            (error) => handleFirestoreError(error, OperationType.GET, subDocPath)
          )
        );

        const allowedIds = Array.from(new Set(link.allowedCompanyIds)).filter(Boolean);
        if (allowedIds.length === 0) {
          setCompanies([]);
          setSchedules([]);
          setEmployees([]);
          setCustomHolidays([]);
          setMonthOverrides([]);
          setDataLoading(false);
          return;
        }

        const companyMap = new Map<string, Company>();
        const schedulesByComp = new Map<string, Schedule[]>();
        const employeesByComp = new Map<string, Employee[]>();
        const holidaysByComp = new Map<string, CustomHoliday[]>();
        const overridesByComp = new Map<string, MonthOverride[]>();

        const doneComps = new Set<string>();
        const doneSch = new Set<string>();
        const doneEmp = new Set<string>();
        const doneHol = new Set<string>();
        const doneOv = new Set<string>();

        const checkSubUserDone = () => {
          if (
            !cancelled &&
            doneComps.size === allowedIds.length &&
            doneSch.size === allowedIds.length &&
            doneEmp.size === allowedIds.length &&
            doneHol.size === allowedIds.length &&
            doneOv.size === allowedIds.length
          ) {
            setDataLoading(false);
          }
        };

        for (const cid of allowedIds) {
          const compDocPath = `users/${ownerUid}/companies/${cid}`;
          dataUnsubs.push(
            onSnapshot(
              doc(db, compDocPath),
              (snap) => {
                if (snap.exists()) {
                  companyMap.set(cid, {
                    id: snap.id,
                    ...(snap.data() as Omit<Company, 'id'>),
                  });
                } else {
                  companyMap.delete(cid);
                }
                setCompanies(
                  Array.from(companyMap.values()).sort((a, b) =>
                    a.name.localeCompare(b.name, 'pt-BR')
                  )
                );
                doneComps.add(cid);
                checkSubUserDone();
              },
              (error) => handleFirestoreError(error, OperationType.GET, compDocPath)
            )
          );

          const schPath = `users/${ownerUid}/schedules`;
          dataUnsubs.push(
            onSnapshot(
              query(collection(db, schPath), where('companyId', '==', cid)),
              (snap) => {
                schedulesByComp.set(
                  cid,
                  snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Schedule, 'id'>) }))
                );
                setSchedules(
                  Array.from(schedulesByComp.values())
                    .flat()
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                );
                doneSch.add(cid);
                checkSubUserDone();
              },
              (error) => handleFirestoreError(error, OperationType.GET, schPath)
            )
          );

          const empPath = `users/${ownerUid}/employees`;
          dataUnsubs.push(
            onSnapshot(
              query(collection(db, empPath), where('companyId', '==', cid)),
              (snap) => {
                employeesByComp.set(
                  cid,
                  snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, 'id'>) }))
                );
                setEmployees(
                  Array.from(employeesByComp.values())
                    .flat()
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                );
                doneEmp.add(cid);
                checkSubUserDone();
              },
              (error) => handleFirestoreError(error, OperationType.GET, empPath)
            )
          );

          const holPath = `users/${ownerUid}/customHolidays`;
          dataUnsubs.push(
            onSnapshot(
              query(collection(db, holPath), where('companyId', '==', cid)),
              (snap) => {
                holidaysByComp.set(
                  cid,
                  snap.docs.map((d) => ({
                    id: d.id,
                    ...(d.data() as Omit<CustomHoliday, 'id'>),
                  }))
                );
                setCustomHolidays(
                  Array.from(holidaysByComp.values())
                    .flat()
                    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
                );
                doneHol.add(cid);
                checkSubUserDone();
              },
              (error) => handleFirestoreError(error, OperationType.GET, holPath)
            )
          );

          const ovPath = `users/${ownerUid}/monthOverrides`;
          dataUnsubs.push(
            onSnapshot(
              query(collection(db, ovPath), where('companyId', '==', cid)),
              (snap) => {
                overridesByComp.set(
                  cid,
                  snap.docs.map((d) => ({
                    id: d.id,
                    ...(d.data() as Omit<MonthOverride, 'id'>),
                  }))
                );
                setMonthOverrides(Array.from(overridesByComp.values()).flat());
                doneOv.add(cid);
                checkSubUserDone();
              },
              (error) => handleFirestoreError(error, OperationType.GET, ovPath)
            )
          );
        }
      };

      unsubs.push(
        onSnapshot(
          doc(db, linkPath),
          (snap) => {
            if (!snap.exists()) {
              clearDataUnsubs();
              setAccessLink(null);
              setAccessDeniedInactive(true);
              setDataLoading(false);
              return;
            }
            const nextLink = snap.data() as UserAccessLink;
            setAccessLink(nextLink);
            subscribeScopedWorkspace(nextLink);
          },
          (error) => handleFirestoreError(error, OperationType.GET, linkPath)
        )
      );
    };

    void startSync();

    return () => {
      cancelled = true;
      clearDataUnsubs();
      for (const unsub of unsubs) unsub();
    };
  }, [authReady, user, emailVerified]);

  const activePermissions: PermissionKey[] = useMemo(() => {
    if (isWorkspaceOwner) return ALL_PERMISSION_KEYS;
    return assignedProfile?.permissions ?? [];
  }, [isWorkspaceOwner, assignedProfile]);

  const can = useCallback(
    (perm: PermissionKey) => {
      if (isWorkspaceOwner) return true;
      return activePermissions.includes(perm);
    },
    [isWorkspaceOwner, activePermissions]
  );

  // Additional listeners when a sub-user is granted users.view or profiles.view
  useEffect(() => {
    if (!authReady || !user || !emailVerified || isWorkspaceOwner || !workspaceOwnerId || accessDeniedInactive) {
      return;
    }
    const extraUnsubs: Array<() => void> = [];
    if (can('profiles.view') || can('users.view')) {
      const profilesPath = `users/${workspaceOwnerId}/accessProfiles`;
      extraUnsubs.push(
        onSnapshot(
          query(collection(db, profilesPath), where('ownerId', '==', workspaceOwnerId)),
          (snap) => {
            setAccessProfiles(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<AccessProfile, 'id'>) }))
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
            );
          },
          (error) => handleFirestoreError(error, OperationType.GET, profilesPath)
        )
      );
    } else {
      setAccessProfiles(assignedProfile ? [assignedProfile] : []);
    }

    if (can('users.view')) {
      const teamUsersPath = `users/${workspaceOwnerId}/teamUsers`;
      extraUnsubs.push(
        onSnapshot(
          query(collection(db, teamUsersPath), where('ownerId', '==', workspaceOwnerId)),
          (snap) => {
            setTeamUsers(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<TeamUser, 'id'>) }))
                .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'))
            );
          },
          (error) => handleFirestoreError(error, OperationType.GET, teamUsersPath)
        )
      );
    } else {
      setTeamUsers([]);
    }

    return () => {
      for (const fn of extraUnsubs) fn();
    };
  }, [
    authReady,
    user,
    emailVerified,
    isWorkspaceOwner,
    workspaceOwnerId,
    accessDeniedInactive,
    assignedProfile,
    can,
  ]);

  // Keep selectedCompanyId valid when companies change
  useEffect(() => {
    if (companies.length === 0) {
      setSelectedCompanyId('');
      return;
    }
    const saved = localStorage.getItem('pontorural_selected_company');
    const existsCurrent = companies.some((c) => c.id === selectedCompanyId);
    if (!existsCurrent) {
      const matchSaved = saved && companies.some((c) => c.id === saved);
      setSelectedCompanyId(matchSaved ? saved : companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  const selectCompany = useCallback((id: string) => {
    setSelectedCompanyId(id);
    localStorage.setItem('pontorural_selected_company', id);
  }, []);

  const mapAuthError = (err: unknown): string => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: unknown }).code)
        : '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Usuário (e-mail) ou senha incorretos.';
      case 'auth/invalid-email':
        return 'Informe um endereço de e-mail válido.';
      case 'auth/email-already-in-use':
        return 'Este e-mail já está cadastrado. Use outro e-mail para o novo usuário.';
      case 'auth/weak-password':
        return 'A senha deve ter pelo menos 6 caracteres.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas em sequência. Aguarde alguns minutos e tente novamente.';
      case 'auth/operation-not-allowed':
        return 'O provedor E-mail/Senha ainda não está ativado no Firebase Console (Authentication → Sign-in method).';
      case 'auth/network-request-failed':
        return 'Falha de conexão com a internet. Verifique sua rede e tente novamente.';
      default:
        return err instanceof Error ? err.message : 'Não foi possível concluir a autenticação.';
    }
  };

  const signInWithEmail = useCallback(
    async (email: string, password: string, keepSignedIn = true) => {
      setAuthLoading(true);
      setAuthError(null);
      setAuthMessage(null);
      try {
        await setPersistence(
          auth,
          keepSignedIn ? browserLocalPersistence : browserSessionPersistence
        );
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        setEmailVerified(cred.user.emailVerified);
      } catch (err: unknown) {
        setAuthError(mapAuthError(err));
      } finally {
        setAuthLoading(false);
      }
    },
    []
  );

  const registerWithEmail = useCallback(
    async (
      displayName: string,
      email: string,
      password: string,
      keepSignedIn = true,
      planId: PlanId = 'profissional',
      billingCycle: BillingCycle = 'monthly'
    ) => {
      setAuthLoading(true);
      setAuthError(null);
      setAuthMessage(null);
      try {
        localStorage.setItem(
          PENDING_PLAN_STORAGE_KEY,
          JSON.stringify({ planId, billingCycle })
        );
        await setPersistence(
          auth,
          keepSignedIn ? browserLocalPersistence : browserSessionPersistence
        );
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
        await sendEmailVerification(cred.user);
        setEmailVerified(cred.user.emailVerified);
        setAuthMessage(
          `Cadastro criado no plano selecionado! Enviamos um link de confirmação para ${email.trim()}.`
        );
      } catch (err: unknown) {
        setAuthError(mapAuthError(err));
      } finally {
        setAuthLoading(false);
      }
    },
    []
  );

  const sendResetPassword = useCallback(async (email: string) => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setAuthMessage(`Enviamos as instruções de redefinição de senha para ${email.trim()}.`);
    } catch (err: unknown) {
      setAuthError(mapAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setAuthMessage(`Novo e-mail de verificação enviado para ${auth.currentUser.email}.`);
    } catch (err: unknown) {
      setAuthError(mapAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const refreshEmailVerification = useCallback(async () => {
    if (!auth.currentUser) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      await auth.currentUser.reload();
      const tokenResult = await auth.currentUser.getIdTokenResult(true);
      const verified = Boolean(
        auth.currentUser.emailVerified && tokenResult.claims.email_verified
      );
      setEmailVerified(verified);
      if (!verified) {
        setAuthError(
          'O e-mail ainda consta como não verificado. Clique no link enviado para sua caixa de entrada e tente novamente.'
        );
      }
    } catch (err: unknown) {
      setAuthError(mapAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const clearAuthFeedback = useCallback(() => {
    setAuthError(null);
    setAuthMessage(null);
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);
    setAuthMessage(null);
    await signOut(auth);
  }, []);

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) ?? companies[0] ?? null,
    [companies, selectedCompanyId]
  );

  const companySchedules = useMemo(
    () => schedules.filter((s) => s.companyId === (activeCompany?.id ?? '')),
    [schedules, activeCompany]
  );

  const companyEmployees = useMemo(
    () => employees.filter((e) => e.companyId === (activeCompany?.id ?? '')),
    [employees, activeCompany]
  );

  const companyHolidays = useMemo(
    () => customHolidays.filter((h) => h.companyId === (activeCompany?.id ?? '')),
    [customHolidays, activeCompany]
  );

  const ownerUid = workspaceOwnerId || user?.uid || '';

  const saveCompany = useCallback(
    async (input: { id?: string; name: string; cnpj: string; address: string }) => {
      if (!user || !ownerUid) throw new Error('Usuário não autenticado.');
      const id = input.id || crypto.randomUUID();
      const docPath = `users/${ownerUid}/companies/${id}`;
      const payload = {
        name: sanitizeString(input.name, FIELD_LIMITS.companyNameMax),
        cnpj: sanitizeString(input.cnpj, FIELD_LIMITS.cnpjMax),
        address: sanitizeString(input.address, FIELD_LIMITS.addressMax),
      };

      try {
        if (input.id) {
          await updateDoc(doc(db, docPath), {
            ...payload,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, docPath), {
            ownerId: ownerUid,
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          selectCompany(id);
        }
        return id;
      } catch (error) {
        handleFirestoreError(error, input.id ? OperationType.UPDATE : OperationType.CREATE, docPath);
      }
    },
    [user, ownerUid, selectCompany]
  );

  const deleteCompany = useCallback(
    async (companyId: string) => {
      if (!user || !ownerUid) return;
      const relatedSchedules = schedules.filter((s) => s.companyId === companyId);
      const relatedEmployees = employees.filter((e) => e.companyId === companyId);
      const relatedHolidays = customHolidays.filter((h) => h.companyId === companyId);
      const relatedOverrides = monthOverrides.filter((o) => o.companyId === companyId);

      for (const emp of relatedEmployees) {
        const p = `users/${ownerUid}/employees/${emp.id}`;
        try {
          await deleteDoc(doc(db, p));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, p);
        }
      }
      for (const sch of relatedSchedules) {
        const p = `users/${ownerUid}/schedules/${sch.id}`;
        try {
          await deleteDoc(doc(db, p));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, p);
        }
      }
      for (const hol of relatedHolidays) {
        const p = `users/${ownerUid}/customHolidays/${hol.id}`;
        try {
          await deleteDoc(doc(db, p));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, p);
        }
      }
      for (const ov of relatedOverrides) {
        const p = `users/${ownerUid}/monthOverrides/${ov.id}`;
        try {
          await deleteDoc(doc(db, p));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, p);
        }
      }

      const compPath = `users/${ownerUid}/companies/${companyId}`;
      try {
        await deleteDoc(doc(db, compPath));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, compPath);
      }
    },
    [user, ownerUid, schedules, employees, customHolidays, monthOverrides]
  );

  const saveSchedule = useCallback(
    async (input: {
      id?: string;
      companyId: string;
      name: string;
      descriptionText: string;
      restDays: number[];
      defaultMorningEnd: string;
      defaultAfternoonStart: string;
      showPreFilledInterval: boolean;
    }) => {
      if (!user || !ownerUid) throw new Error('Usuário não autenticado.');
      const id = input.id || crypto.randomUUID();
      const docPath = `users/${ownerUid}/schedules/${id}`;
      const cleanRestDays = Array.from(new Set(input.restDays))
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        .sort((a, b) => a - b);

      const baseFields = {
        name: sanitizeString(input.name, FIELD_LIMITS.scheduleNameMax),
        descriptionText: sanitizeString(input.descriptionText, FIELD_LIMITS.scheduleDescMax),
        restDays: cleanRestDays,
        defaultMorningEnd: sanitizeString(input.defaultMorningEnd, FIELD_LIMITS.timeMax),
        defaultAfternoonStart: sanitizeString(input.defaultAfternoonStart, FIELD_LIMITS.timeMax),
        showPreFilledInterval: Boolean(input.showPreFilledInterval),
      };

      try {
        if (input.id) {
          await updateDoc(doc(db, docPath), {
            ...baseFields,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, docPath), {
            ownerId: ownerUid,
            companyId: input.companyId,
            ...baseFields,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return id;
      } catch (error) {
        handleFirestoreError(error, input.id ? OperationType.UPDATE : OperationType.CREATE, docPath);
      }
    },
    [user, ownerUid]
  );

  const deleteSchedule = useCallback(
    async (scheduleId: string) => {
      if (!user || !ownerUid) return;
      const docPath = `users/${ownerUid}/schedules/${scheduleId}`;
      try {
        await deleteDoc(doc(db, docPath));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [user, ownerUid]
  );

  const saveEmployee = useCallback(
    async (input: {
      id?: string;
      companyId: string;
      scheduleId: string;
      name: string;
      role: string;
      cpf: string;
      registrationNumber: string;
      admissionDate: string;
      birthDate?: string;
      active: boolean;
    }) => {
      if (!user || !ownerUid) throw new Error('Usuário não autenticado.');
      const id = input.id || crypto.randomUUID();
      const docPath = `users/${ownerUid}/employees/${id}`;
      const cleanBirthDate =
        typeof input.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.birthDate.trim())
          ? input.birthDate.trim()
          : '';
      const baseFields = {
        scheduleId: input.scheduleId,
        name: sanitizeString(input.name.toUpperCase(), FIELD_LIMITS.employeeNameMax),
        role: sanitizeString(input.role.toUpperCase(), FIELD_LIMITS.employeeRoleMax),
        cpf: sanitizeString(input.cpf, FIELD_LIMITS.cpfMax),
        registrationNumber: sanitizeString(input.registrationNumber, FIELD_LIMITS.registrationMax),
        admissionDate: input.admissionDate,
        birthDate: cleanBirthDate,
        active: Boolean(input.active),
      };

      try {
        if (input.id) {
          await updateDoc(doc(db, docPath), {
            ...baseFields,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, docPath), {
            ownerId: ownerUid,
            companyId: input.companyId,
            ...baseFields,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return id;
      } catch (error) {
        handleFirestoreError(error, input.id ? OperationType.UPDATE : OperationType.CREATE, docPath);
      }
    },
    [user, ownerUid]
  );

  const deleteEmployee = useCallback(
    async (employeeId: string) => {
      if (!user || !ownerUid) return;
      const docPath = `users/${ownerUid}/employees/${employeeId}`;
      try {
        await deleteDoc(doc(db, docPath));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [user, ownerUid]
  );

  const saveCustomHoliday = useCallback(
    async (input: {
      id?: string;
      companyId: string;
      name: string;
      dateKey: string;
      recurringYearly: boolean;
    }) => {
      if (!user || !ownerUid) throw new Error('Usuário não autenticado.');
      const id = input.id || crypto.randomUUID();
      const docPath = `users/${ownerUid}/customHolidays/${id}`;
      const baseFields = {
        name: sanitizeString(input.name, FIELD_LIMITS.holidayNameMax),
        dateKey: input.dateKey,
        recurringYearly: Boolean(input.recurringYearly),
      };

      try {
        if (input.id) {
          await updateDoc(doc(db, docPath), {
            ...baseFields,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, docPath), {
            ownerId: ownerUid,
            companyId: input.companyId,
            ...baseFields,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return id;
      } catch (error) {
        handleFirestoreError(error, input.id ? OperationType.UPDATE : OperationType.CREATE, docPath);
      }
    },
    [user, ownerUid]
  );

  const deleteCustomHoliday = useCallback(
    async (holidayId: string) => {
      if (!user || !ownerUid) return;
      const docPath = `users/${ownerUid}/customHolidays/${holidayId}`;
      try {
        await deleteDoc(doc(db, docPath));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [user, ownerUid]
  );

  const saveDayOverride = useCallback(
    async (params: {
      companyId: string;
      yearMonth: string;
      targetId: string;
      dayKey: string;
      entry: DayOverrideEntry | null;
    }) => {
      if (!user || !ownerUid) throw new Error('Usuário não autenticado.');
      const overrideId = `${params.companyId}_${params.yearMonth}_${params.targetId}`;
      const docPath = `users/${ownerUid}/monthOverrides/${overrideId}`;
      const existingDoc = monthOverrides.find((m) => m.id === overrideId);
      const nextMap: Record<string, DayOverrideEntry> = {
        ...(existingDoc?.dayOverrides ?? {}),
      };

      if (params.entry === null) {
        delete nextMap[params.dayKey];
      } else {
        nextMap[params.dayKey] = params.entry;
      }

      try {
        if (existingDoc) {
          await updateDoc(doc(db, docPath), {
            dayOverrides: nextMap,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, docPath), {
            ownerId: ownerUid,
            companyId: params.companyId,
            yearMonth: params.yearMonth,
            targetId: params.targetId,
            dayOverrides: nextMap,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(
          error,
          existingDoc ? OperationType.UPDATE : OperationType.CREATE,
          docPath
        );
      }
    },
    [user, ownerUid, monthOverrides]
  );

  const clearMonthOverrides = useCallback(
    async (companyId: string, yearMonth: string, targetId: string) => {
      if (!user || !ownerUid) return;
      const overrideId = `${companyId}_${yearMonth}_${targetId}`;
      const existingDoc = monthOverrides.find((m) => m.id === overrideId);
      if (!existingDoc) return;
      const docPath = `users/${ownerUid}/monthOverrides/${overrideId}`;
      try {
        await deleteDoc(doc(db, docPath));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [user, ownerUid, monthOverrides]
  );

  const seedExampleCompany = useCallback(async () => {
    if (!user || !isWorkspaceOwner) return;
    const companyId = await saveCompany({
      name: 'FAZENDA MODELO AGROPECUÁRIA LTDA',
      cnpj: '00.000.000/0001-00',
      address: 'Estrada Rural Km 15, Sede, Zona Rural, Eunápolis - BA',
    });
    if (!companyId) return;

    const scheduleId = await saveSchedule({
      companyId,
      name: 'Trabalhador Rural 44h (Seg-Qui 17h / Sex 16h)',
      descriptionText:
        '07:00 AS 12:00/13:00 AS 17:00- QUI 07:00 AS 12:00/13:00 AS 16:00 - Sábado: 00:00 as : / : as 00:',
      restDays: [0, 6],
      defaultMorningEnd: '12:00',
      defaultAfternoonStart: '13:00',
      showPreFilledInterval: true,
    });
    if (!scheduleId) return;

    await saveEmployee({
      companyId,
      scheduleId,
      name: 'JOÃO DA SILVA SANTOS',
      role: '040 - TRABALHADOR RURAL',
      cpf: '000.000.000-00',
      registrationNumber: '1001',
      admissionDate: '2026-01-10',
      active: true,
    });
  }, [user, isWorkspaceOwner, saveCompany, saveSchedule, saveEmployee]);

  const saveSubscriptionPlan = useCallback(
    async (planId: PlanId, billingCycle: BillingCycle) => {
      if (!user || !isWorkspaceOwner) throw new Error('Apenas o titular da conta pode alterar o plano.');
      const subDocPath = `users/${user.uid}/subscriptions/current`;
      try {
        if (subscription) {
          await updateDoc(doc(db, subDocPath), {
            planId,
            billingCycle,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, subDocPath), {
            ownerId: user.uid,
            planId,
            billingCycle,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(
          error,
          subscription ? OperationType.UPDATE : OperationType.CREATE,
          subDocPath
        );
      }
    },
    [user, isWorkspaceOwner, subscription]
  );

  const importBackupJson = useCallback(
    async (rawJson: string) => {
      if (!user || !isWorkspaceOwner) {
        throw new Error('Apenas o titular da conta pode restaurar backups JSON.');
      }
      return importBackupBundlesToFirestore(user.uid, rawJson);
    },
    [user, isWorkspaceOwner]
  );

  const importEmployeesBatch = useCallback(
    async (params: {
      companyId: string;
      rows: NormalizedEmployeeRow[];
      duplicateStrategy: 'update' | 'skip';
      onProgress?: (done: number, total: number) => void;
    }) => {
      if (!user || !ownerUid) throw new Error('Usuário não autenticado.');
      const total = params.rows.length;
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (let i = 0; i < total; i++) {
        const row = params.rows[i];
        if (row.errors.length > 0 || !row.scheduleId) {
          skipped++;
          params.onProgress?.(i + 1, total);
          continue;
        }

        if (row.existingEmployeeId && params.duplicateStrategy === 'skip') {
          skipped++;
          params.onProgress?.(i + 1, total);
          continue;
        }

        const empId = row.existingEmployeeId || crypto.randomUUID();
        const docPath = `users/${ownerUid}/employees/${empId}`;
        const baseFields = {
          scheduleId: row.scheduleId,
          name: sanitizeString(row.name.toUpperCase(), FIELD_LIMITS.employeeNameMax),
          role: sanitizeString(row.role.toUpperCase(), FIELD_LIMITS.employeeRoleMax),
          cpf: sanitizeString(row.cpf, FIELD_LIMITS.cpfMax),
          registrationNumber: sanitizeString(
            row.registrationNumber,
            FIELD_LIMITS.registrationMax
          ),
          admissionDate: row.admissionDate,
          birthDate:
            typeof row.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.birthDate)
              ? row.birthDate
              : '',
          active: Boolean(row.active),
        };

        try {
          if (row.existingEmployeeId) {
            await updateDoc(doc(db, docPath), {
              ...baseFields,
              updatedAt: serverTimestamp(),
            });
            updated++;
          } else {
            await setDoc(doc(db, docPath), {
              ownerId: ownerUid,
              companyId: params.companyId,
              ...baseFields,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            created++;
          }
        } catch (error) {
          handleFirestoreError(
            error,
            row.existingEmployeeId ? OperationType.UPDATE : OperationType.CREATE,
            docPath
          );
        }

        params.onProgress?.(i + 1, total);
      }

      return { created, updated, skipped };
    },
    [user, ownerUid]
  );

  // Access Profiles CRUD
  const saveAccessProfile = useCallback(
    async (input: {
      id?: string;
      name: string;
      description: string;
      permissions: PermissionKey[];
    }) => {
      if (!user || !ownerUid) throw new Error('Usuário não autenticado.');
      const id = input.id || crypto.randomUUID();
      const docPath = `users/${ownerUid}/accessProfiles/${id}`;
      const cleanPermissions = Array.from(new Set(input.permissions)).slice(0, 64);
      const payload = {
        name: sanitizeString(input.name, FIELD_LIMITS.profileNameMax),
        description: sanitizeString(input.description, FIELD_LIMITS.profileDescMax),
        permissions: cleanPermissions,
      };

      try {
        if (input.id) {
          await updateDoc(doc(db, docPath), {
            ...payload,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, docPath), {
            ownerId: ownerUid,
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return id;
      } catch (error) {
        handleFirestoreError(error, input.id ? OperationType.UPDATE : OperationType.CREATE, docPath);
      }
    },
    [user, ownerUid]
  );

  const deleteAccessProfile = useCallback(
    async (profileId: string) => {
      if (!user || !ownerUid) return;
      const docPath = `users/${ownerUid}/accessProfiles/${profileId}`;
      try {
        await deleteDoc(doc(db, docPath));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [user, ownerUid]
  );

  // Team Users CRUD (synced with /userAccessLinks/{authUid})
  const createTeamUser = useCallback(
    async (input: {
      displayName: string;
      email: string;
      password: string;
      profileId: string;
      allowedCompanyIds: string[];
      active: boolean;
    }) => {
      if (!user || !ownerUid) throw new Error('Usuário não autenticado.');
      const cleanName = sanitizeString(input.displayName, FIELD_LIMITS.teamUserNameMax);
      const cleanEmail = sanitizeString(input.email.toLowerCase(), FIELD_LIMITS.teamUserEmailMax);
      const cleanCompanyIds = Array.from(new Set(input.allowedCompanyIds)).slice(0, 50);

      let createdAuthUid = '';
      try {
        createdAuthUid = await createSecondaryAuthUser({
          displayName: cleanName,
          email: cleanEmail,
          password: input.password,
        });
      } catch (err: unknown) {
        throw new Error(mapAuthError(err));
      }

      const teamUserId = crypto.randomUUID();
      const docPath = `users/${ownerUid}/teamUsers/${teamUserId}`;
      const linkPath = `userAccessLinks/${createdAuthUid}`;

      try {
        await setDoc(doc(db, docPath), {
          ownerId: ownerUid,
          authUid: createdAuthUid,
          displayName: cleanName,
          email: cleanEmail,
          profileId: input.profileId,
          allowedCompanyIds: cleanCompanyIds,
          active: Boolean(input.active),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, linkPath), {
          ownerId: ownerUid,
          authUid: createdAuthUid,
          teamUserId,
          profileId: input.profileId,
          allowedCompanyIds: cleanCompanyIds,
          active: Boolean(input.active),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return teamUserId;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    },
    [user, ownerUid]
  );

  const updateTeamUser = useCallback(
    async (input: {
      id: string;
      authUid: string;
      displayName: string;
      profileId: string;
      allowedCompanyIds: string[];
      active: boolean;
    }) => {
      if (!user || !ownerUid) throw new Error('Usuário não autenticado.');
      const cleanCompanyIds = Array.from(new Set(input.allowedCompanyIds)).slice(0, 50);
      const docPath = `users/${ownerUid}/teamUsers/${input.id}`;
      const linkPath = `userAccessLinks/${input.authUid}`;

      try {
        await updateDoc(doc(db, docPath), {
          displayName: sanitizeString(input.displayName, FIELD_LIMITS.teamUserNameMax),
          profileId: input.profileId,
          allowedCompanyIds: cleanCompanyIds,
          active: Boolean(input.active),
          updatedAt: serverTimestamp(),
        });

        if (input.authUid) {
          const linkRef = doc(db, linkPath);
          const linkSnap = await getDoc(linkRef);
          if (linkSnap.exists()) {
            await updateDoc(linkRef, {
              profileId: input.profileId,
              allowedCompanyIds: cleanCompanyIds,
              active: Boolean(input.active),
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(linkRef, {
              ownerId: ownerUid,
              authUid: input.authUid,
              teamUserId: input.id,
              profileId: input.profileId,
              allowedCompanyIds: cleanCompanyIds,
              active: Boolean(input.active),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      }
    },
    [user, ownerUid]
  );

  const deleteTeamUser = useCallback(
    async (teamUser: TeamUser) => {
      if (!user || !ownerUid) return;
      const docPath = `users/${ownerUid}/teamUsers/${teamUser.id}`;
      try {
        await deleteDoc(doc(db, docPath));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
      if (teamUser.authUid) {
        const linkPath = `userAccessLinks/${teamUser.authUid}`;
        try {
          await deleteDoc(doc(db, linkPath));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, linkPath);
        }
      }
    },
    [user, ownerUid]
  );

  return {
    user,
    emailVerified,
    authReady,
    authLoading,
    authError,
    authMessage,
    connectionWarning,
    dataLoading,
    isWorkspaceOwner,
    workspaceOwnerId,
    accessLink,
    assignedProfile,
    accessDeniedInactive,
    activePermissions,
    can,
    companies,
    schedules,
    employees,
    customHolidays,
    teamUsers,
    accessProfiles,
    subscription,
    activeCompany,
    selectedCompanyId,
    selectCompany,
    companySchedules,
    companyEmployees,
    companyHolidays,
    monthOverrides,
    signInWithEmail,
    registerWithEmail,
    sendResetPassword,
    resendVerificationEmail,
    refreshEmailVerification,
    clearAuthFeedback,
    logout,
    saveCompany,
    deleteCompany,
    saveSchedule,
    deleteSchedule,
    saveEmployee,
    deleteEmployee,
    saveCustomHoliday,
    deleteCustomHoliday,
    saveDayOverride,
    clearMonthOverrides,
    seedExampleCompany,
    saveSubscriptionPlan,
    importBackupJson,
    importEmployeesBatch,
    saveAccessProfile,
    deleteAccessProfile,
    createTeamUser,
    updateTeamUser,
    deleteTeamUser,
  };
}
