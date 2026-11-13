import { useEffect, useMemo, useState, useCallback } from 'react';
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
  db,
  handleFirestoreError,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  Company,
  CustomHoliday,
  DayOverrideEntry,
  Employee,
  FIELD_LIMITS,
  MonthOverride,
  Schedule,
} from '../types/timesheet';
import { BillingCycle, PlanId } from '../constants/plans';
import {
  importBackupBundlesToFirestore,
  runUserMigrations,
} from '../services/migrations';

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

  const [companies, setCompanies] = useState<Company[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);
  const [monthOverrides, setMonthOverrides] = useState<MonthOverride[]>([]);
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
      setCompanies([]);
      setSchedules([]);
      setEmployees([]);
      setCustomHolidays([]);
      setMonthOverrides([]);
      setSubscription(null);
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    const unsubs: Array<() => void> = [];
    setDataLoading(true);
    const uid = user.uid;

    const loadedFlags = {
      companies: false,
      schedules: false,
      employees: false,
      holidays: false,
      overrides: false,
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
        loadedFlags.subscription
      ) {
        setDataLoading(false);
      }
    };

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

      // Run idempotent versioned Firestore schema migrations before/with listeners
      try {
        await runUserMigrations(uid);
      } catch (err) {
        console.error('Migration runner error:', err);
      }
      if (cancelled) return;

      const companiesPath = `users/${uid}/companies`;
      unsubs.push(
        onSnapshot(
          query(collection(db, companiesPath), where('ownerId', '==', uid)),
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

      const schedulesPath = `users/${uid}/schedules`;
      unsubs.push(
        onSnapshot(
          query(collection(db, schedulesPath), where('ownerId', '==', uid)),
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

      const employeesPath = `users/${uid}/employees`;
      unsubs.push(
        onSnapshot(
          query(collection(db, employeesPath), where('ownerId', '==', uid)),
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

      const holidaysPath = `users/${uid}/customHolidays`;
      unsubs.push(
        onSnapshot(
          query(collection(db, holidaysPath), where('ownerId', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({
                id: d.id,
                ...(d.data() as Omit<CustomHoliday, 'id'>),
              }))
              .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
            setCustomHolidays(list);
            loadedFlags.holidays = true;
            checkDone();
          },
          (error) => handleFirestoreError(error, OperationType.GET, holidaysPath)
        )
      );

      const overridesPath = `users/${uid}/monthOverrides`;
      unsubs.push(
        onSnapshot(
          query(collection(db, overridesPath), where('ownerId', '==', uid)),
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

      const subDocPath = `users/${uid}/subscriptions/current`;
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
    };

    void startSync();

    return () => {
      cancelled = true;
      for (const unsub of unsubs) unsub();
    };
  }, [authReady, user, emailVerified]);

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
        return 'Este e-mail já está cadastrado. Faça login ou redefina a senha.';
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

  const saveCompany = useCallback(
    async (input: { id?: string; name: string; cnpj: string; address: string }) => {
      if (!user) throw new Error('Usuário não autenticado.');
      const uid = user.uid;
      const id = input.id || crypto.randomUUID();
      const docPath = `users/${uid}/companies/${id}`;
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
            ownerId: uid,
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
    [user, selectCompany]
  );

  const deleteCompany = useCallback(
    async (companyId: string) => {
      if (!user) return;
      const uid = user.uid;
      // Delete dependent records cleanly first
      const relatedSchedules = schedules.filter((s) => s.companyId === companyId);
      const relatedEmployees = employees.filter((e) => e.companyId === companyId);
      const relatedHolidays = customHolidays.filter((h) => h.companyId === companyId);
      const relatedOverrides = monthOverrides.filter((o) => o.companyId === companyId);

      for (const emp of relatedEmployees) {
        const p = `users/${uid}/employees/${emp.id}`;
        try {
          await deleteDoc(doc(db, p));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, p);
        }
      }
      for (const sch of relatedSchedules) {
        const p = `users/${uid}/schedules/${sch.id}`;
        try {
          await deleteDoc(doc(db, p));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, p);
        }
      }
      for (const hol of relatedHolidays) {
        const p = `users/${uid}/customHolidays/${hol.id}`;
        try {
          await deleteDoc(doc(db, p));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, p);
        }
      }
      for (const ov of relatedOverrides) {
        const p = `users/${uid}/monthOverrides/${ov.id}`;
        try {
          await deleteDoc(doc(db, p));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, p);
        }
      }

      const compPath = `users/${uid}/companies/${companyId}`;
      try {
        await deleteDoc(doc(db, compPath));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, compPath);
      }
    },
    [user, schedules, employees, customHolidays, monthOverrides]
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
      if (!user) throw new Error('Usuário não autenticado.');
      const uid = user.uid;
      const id = input.id || crypto.randomUUID();
      const docPath = `users/${uid}/schedules/${id}`;
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
            ownerId: uid,
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
    [user]
  );

  const deleteSchedule = useCallback(
    async (scheduleId: string) => {
      if (!user) return;
      const docPath = `users/${user.uid}/schedules/${scheduleId}`;
      try {
        await deleteDoc(doc(db, docPath));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [user]
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
      active: boolean;
    }) => {
      if (!user) throw new Error('Usuário não autenticado.');
      const uid = user.uid;
      const id = input.id || crypto.randomUUID();
      const docPath = `users/${uid}/employees/${id}`;
      const baseFields = {
        scheduleId: input.scheduleId,
        name: sanitizeString(input.name.toUpperCase(), FIELD_LIMITS.employeeNameMax),
        role: sanitizeString(input.role.toUpperCase(), FIELD_LIMITS.employeeRoleMax),
        cpf: sanitizeString(input.cpf, FIELD_LIMITS.cpfMax),
        registrationNumber: sanitizeString(input.registrationNumber, FIELD_LIMITS.registrationMax),
        admissionDate: input.admissionDate,
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
            ownerId: uid,
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
    [user]
  );

  const deleteEmployee = useCallback(
    async (employeeId: string) => {
      if (!user) return;
      const docPath = `users/${user.uid}/employees/${employeeId}`;
      try {
        await deleteDoc(doc(db, docPath));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [user]
  );

  const saveCustomHoliday = useCallback(
    async (input: {
      id?: string;
      companyId: string;
      name: string;
      dateKey: string;
      recurringYearly: boolean;
    }) => {
      if (!user) throw new Error('Usuário não autenticado.');
      const uid = user.uid;
      const id = input.id || crypto.randomUUID();
      const docPath = `users/${uid}/customHolidays/${id}`;
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
            ownerId: uid,
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
    [user]
  );

  const deleteCustomHoliday = useCallback(
    async (holidayId: string) => {
      if (!user) return;
      const docPath = `users/${user.uid}/customHolidays/${holidayId}`;
      try {
        await deleteDoc(doc(db, docPath));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [user]
  );

  const saveDayOverride = useCallback(
    async (params: {
      companyId: string;
      yearMonth: string;
      targetId: string; // 'ALL' or employeeId
      dayKey: string;
      entry: DayOverrideEntry | null; // null clears override
    }) => {
      if (!user) throw new Error('Usuário não autenticado.');
      const uid = user.uid;
      const overrideId = `${params.companyId}_${params.yearMonth}_${params.targetId}`;
      const docPath = `users/${uid}/monthOverrides/${overrideId}`;
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
            ownerId: uid,
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
    [user, monthOverrides]
  );

  const clearMonthOverrides = useCallback(
    async (companyId: string, yearMonth: string, targetId: string) => {
      if (!user) return;
      const overrideId = `${companyId}_${yearMonth}_${targetId}`;
      const existingDoc = monthOverrides.find((m) => m.id === overrideId);
      if (!existingDoc) return;
      const docPath = `users/${user.uid}/monthOverrides/${overrideId}`;
      try {
        await deleteDoc(doc(db, docPath));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [user, monthOverrides]
  );

  const seedExampleCompany = useCallback(async () => {
    if (!user) return;
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
  }, [user, saveCompany, saveSchedule, saveEmployee]);

  const saveSubscriptionPlan = useCallback(
    async (planId: PlanId, billingCycle: BillingCycle) => {
      if (!user) throw new Error('Usuário não autenticado.');
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
    [user, subscription]
  );

  const importBackupJson = useCallback(
    async (rawJson: string) => {
      if (!user) throw new Error('Usuário não autenticado.');
      return importBackupBundlesToFirestore(user.uid, rawJson);
    },
    [user]
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
    companies,
    schedules,
    employees,
    customHolidays,
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
  };
}
