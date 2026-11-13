import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import { DayOverrideEntry, FIELD_LIMITS } from '../types/timesheet';
import { CompanyBackupBundle } from '../utils/backupExport';

interface MigrationDefinition {
  id: string;
  version: number;
  name: string;
  run: (uid: string) => Promise<void>;
}

const MIGRATIONS: MigrationDefinition[] = [
  {
    id: '001_initial_subscription_and_schema',
    version: 1,
    name: 'Estrutura inicial de assinatura e coleções do usuário',
    run: async (uid: string) => {
      const subPath = `users/${uid}/subscriptions/current`;
      let existingPlan: { planId?: string; billingCycle?: string } | null = null;
      try {
        const raw = localStorage.getItem('pontorural_pending_plan');
        if (raw) existingPlan = JSON.parse(raw);
      } catch {
        existingPlan = null;
      }

      const subSnap = await getDoc(doc(db, subPath));
      if (!subSnap.exists()) {
        const planId =
          existingPlan?.planId &&
          ['essencial', 'profissional', 'escritorio'].includes(existingPlan.planId)
            ? existingPlan.planId
            : 'essencial';
        const billingCycle =
          existingPlan?.billingCycle && ['monthly', 'yearly'].includes(existingPlan.billingCycle)
            ? existingPlan.billingCycle
            : 'monthly';

        await setDoc(doc(db, subPath), {
          ownerId: uid,
          planId,
          billingCycle,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        localStorage.removeItem('pontorural_pending_plan');
      }
    },
  },
  {
    id: '002_normalize_schedules_and_employees',
    version: 2,
    name: 'Normalização de campos padrão em jornadas e funcionários',
    run: async (uid: string) => {
      const schedulesPath = `users/${uid}/schedules`;
      const schedulesSnap = await getDocs(
        query(collection(db, schedulesPath), where('ownerId', '==', uid))
      );
      for (const sDoc of schedulesSnap.docs) {
        const data = sDoc.data();
        const needsFix =
          !Array.isArray(data.restDays) ||
          typeof data.showPreFilledInterval !== 'boolean' ||
          typeof data.defaultMorningEnd !== 'string' ||
          typeof data.defaultAfternoonStart !== 'string';

        if (needsFix) {
          await updateDoc(doc(db, `${schedulesPath}/${sDoc.id}`), {
            restDays: Array.isArray(data.restDays) ? data.restDays : [0, 6],
            showPreFilledInterval:
              typeof data.showPreFilledInterval === 'boolean'
                ? data.showPreFilledInterval
                : true,
            defaultMorningEnd:
              typeof data.defaultMorningEnd === 'string' ? data.defaultMorningEnd : '12:00',
            defaultAfternoonStart:
              typeof data.defaultAfternoonStart === 'string'
                ? data.defaultAfternoonStart
                : '13:00',
            updatedAt: serverTimestamp(),
          });
        }
      }

      const employeesPath = `users/${uid}/employees`;
      const employeesSnap = await getDocs(
        query(collection(db, employeesPath), where('ownerId', '==', uid))
      );
      for (const eDoc of employeesSnap.docs) {
        const data = eDoc.data();
        if (typeof data.active !== 'boolean') {
          await updateDoc(doc(db, `${employeesPath}/${eDoc.id}`), {
            active: true,
            updatedAt: serverTimestamp(),
          });
        }
      }
    },
  },
];

/**
 * Executa todas as migrações pendentes no Firestore do usuário autenticado de forma idempotente.
 */
export async function runUserMigrations(uid: string): Promise<void> {
  const migrationsPath = `users/${uid}/migrations`;
  let appliedIds = new Set<string>();

  try {
    const snap = await getDocs(
      query(collection(db, migrationsPath), where('ownerId', '==', uid))
    );
    appliedIds = new Set(snap.docs.map((d) => d.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, migrationsPath);
  }

  for (const migration of MIGRATIONS) {
    if (appliedIds.has(migration.id)) continue;

    const recordPath = `${migrationsPath}/${migration.id}`;
    try {
      await migration.run(uid);
      await setDoc(doc(db, recordPath), {
        ownerId: uid,
        version: migration.version,
        name: migration.name,
        status: 'applied',
        appliedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, recordPath);
    }
  }
}

function isValidIdString(id: unknown): id is string {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function clampString(value: unknown, fallback: string, minLen: number, maxLen: number): string {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  const target = cleaned.length >= minLen ? cleaned : fallback;
  return target.slice(0, maxLen);
}

function sanitizeDayOverrides(
  input: unknown
): Record<string, DayOverrideEntry> {
  if (!input || typeof input !== 'object') return {};
  const entries = Object.entries(input as Record<string, DayOverrideEntry>).slice(0, 31);
  const out: Record<string, DayOverrideEntry> = {};
  for (const [k, v] of entries) {
    if (!v || typeof v !== 'object') continue;
    out[k.slice(0, 10)] = v;
  }
  return out;
}

/**
 * Importa e migra um backup JSON (individual ou completo) para o Firestore do usuário.
 */
export async function importBackupBundlesToFirestore(
  uid: string,
  rawJson: string
): Promise<{ companies: number; schedules: number; employees: number; holidays: number }> {
  const parsed = JSON.parse(rawJson) as {
    company?: CompanyBackupBundle['company'];
    schedules?: CompanyBackupBundle['schedules'];
    employees?: CompanyBackupBundle['employees'];
    customHolidays?: CompanyBackupBundle['customHolidays'];
    monthOverrides?: CompanyBackupBundle['monthOverrides'];
    companies?: CompanyBackupBundle[];
  };

  const bundles: CompanyBackupBundle[] = [];
  if (Array.isArray(parsed.companies)) {
    bundles.push(...parsed.companies);
  } else if (parsed.company) {
    bundles.push({
      company: parsed.company,
      summary: {
        schedulesCount: parsed.schedules?.length ?? 0,
        employeesCount: parsed.employees?.length ?? 0,
        customHolidaysCount: parsed.customHolidays?.length ?? 0,
        monthOverridesCount: parsed.monthOverrides?.length ?? 0,
      },
      schedules: parsed.schedules ?? [],
      employees: parsed.employees ?? [],
      customHolidays: parsed.customHolidays ?? [],
      monthOverrides: parsed.monthOverrides ?? [],
    });
  } else {
    throw new Error('Arquivo JSON inválido ou sem dados de empresa compatíveis.');
  }

  let totalCompanies = 0;
  let totalSchedules = 0;
  let totalEmployees = 0;
  let totalHolidays = 0;

  for (const bundle of bundles) {
    const compId = isValidIdString(bundle.company.id)
      ? bundle.company.id
      : crypto.randomUUID();

    const companyPath = `users/${uid}/companies/${compId}`;
    const compSnap = await getDoc(doc(db, companyPath));
    const companyFields = {
      name: clampString(bundle.company.name, 'EMPRESA IMPORTADA', 2, FIELD_LIMITS.companyNameMax),
      cnpj: clampString(bundle.company.cnpj, '00.000.000/0001-00', 11, FIELD_LIMITS.cnpjMax),
      address: clampString(
        bundle.company.address,
        'Endereço não informado',
        4,
        FIELD_LIMITS.addressMax
      ),
    };

    try {
      if (compSnap.exists()) {
        await updateDoc(doc(db, companyPath), {
          ...companyFields,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, companyPath), {
          ownerId: uid,
          ...companyFields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      totalCompanies++;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, companyPath);
    }

    const scheduleIdMap = new Map<string, string>();
    for (const sch of bundle.schedules ?? []) {
      let schId = isValidIdString(sch.id) ? sch.id : crypto.randomUUID();
      let schPath = `users/${uid}/schedules/${schId}`;
      let schSnap = await getDoc(doc(db, schPath));
      if (schSnap.exists() && schSnap.data()?.companyId !== compId) {
        schId = crypto.randomUUID();
        schPath = `users/${uid}/schedules/${schId}`;
        schSnap = await getDoc(doc(db, schPath));
      }
      scheduleIdMap.set(sch.id, schId);

      const schFields = {
        name: clampString(sch.name, 'Jornada Padrão', 2, FIELD_LIMITS.scheduleNameMax),
        descriptionText: clampString(
          sch.descriptionText,
          '07:00 AS 12:00 / 13:00 AS 17:00',
          2,
          FIELD_LIMITS.scheduleDescMax
        ),
        restDays: Array.isArray(sch.restDays)
          ? sch.restDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
          : [0, 6],
        defaultMorningEnd: String(sch.defaultMorningEnd ?? '12:00').slice(0, FIELD_LIMITS.timeMax),
        defaultAfternoonStart: String(sch.defaultAfternoonStart ?? '13:00').slice(
          0,
          FIELD_LIMITS.timeMax
        ),
        showPreFilledInterval: Boolean(sch.showPreFilledInterval ?? true),
      };

      try {
        if (schSnap.exists()) {
          await updateDoc(doc(db, schPath), {
            ...schFields,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, schPath), {
            ownerId: uid,
            companyId: compId,
            ...schFields,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        totalSchedules++;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, schPath);
      }
    }

    const fallbackScheduleId = Array.from(scheduleIdMap.values())[0];

    for (const emp of bundle.employees ?? []) {
      const targetScheduleId = scheduleIdMap.get(emp.scheduleId) ?? fallbackScheduleId;
      if (!targetScheduleId) continue;

      let empId = isValidIdString(emp.id) ? emp.id : crypto.randomUUID();
      let empPath = `users/${uid}/employees/${empId}`;
      let empSnap = await getDoc(doc(db, empPath));
      if (empSnap.exists() && empSnap.data()?.companyId !== compId) {
        empId = crypto.randomUUID();
        empPath = `users/${uid}/employees/${empId}`;
        empSnap = await getDoc(doc(db, empPath));
      }

      const empFields = {
        scheduleId: targetScheduleId,
        name: clampString(
          typeof emp.name === 'string' ? emp.name.toUpperCase() : '',
          'FUNCIONÁRIO',
          2,
          FIELD_LIMITS.employeeNameMax
        ),
        role: clampString(
          typeof emp.role === 'string' ? emp.role.toUpperCase() : '',
          'TRABALHADOR',
          2,
          FIELD_LIMITS.employeeRoleMax
        ),
        cpf: clampString(emp.cpf, '000.000.000-00', 11, FIELD_LIMITS.cpfMax),
        registrationNumber: clampString(
          emp.registrationNumber,
          '1',
          1,
          FIELD_LIMITS.registrationMax
        ),
        admissionDate: /^\d{4}-\d{2}-\d{2}$/.test(emp.admissionDate)
          ? emp.admissionDate
          : new Date().toISOString().slice(0, 10),
        active: Boolean(emp.active ?? true),
      };

      try {
        if (empSnap.exists()) {
          await updateDoc(doc(db, empPath), {
            ...empFields,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, empPath), {
            ownerId: uid,
            companyId: compId,
            ...empFields,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        totalEmployees++;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, empPath);
      }
    }

    for (const hol of bundle.customHolidays ?? []) {
      let holId = isValidIdString(hol.id) ? hol.id : crypto.randomUUID();
      let holPath = `users/${uid}/customHolidays/${holId}`;
      let holSnap = await getDoc(doc(db, holPath));
      if (holSnap.exists() && holSnap.data()?.companyId !== compId) {
        holId = crypto.randomUUID();
        holPath = `users/${uid}/customHolidays/${holId}`;
        holSnap = await getDoc(doc(db, holPath));
      }

      const holFields = {
        name: clampString(hol.name, 'Feriado Local', 2, FIELD_LIMITS.holidayNameMax),
        dateKey: clampString(hol.dateKey, '01-01', 5, 10),
        recurringYearly: Boolean(hol.recurringYearly ?? true),
      };

      try {
        if (holSnap.exists()) {
          await updateDoc(doc(db, holPath), {
            ...holFields,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, holPath), {
            ownerId: uid,
            companyId: compId,
            ...holFields,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        totalHolidays++;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, holPath);
      }
    }

    for (const ov of bundle.monthOverrides ?? []) {
      if (!/^\d{4}-\d{2}$/.test(ov.yearMonth)) continue;
      const targetId = isValidIdString(ov.targetId) ? ov.targetId : 'ALL';
      const ovId = `${compId}_${ov.yearMonth}_${targetId}`;
      const ovPath = `users/${uid}/monthOverrides/${ovId}`;
      const ovSnap = await getDoc(doc(db, ovPath));
      const cleanOverrides = sanitizeDayOverrides(ov.dayOverrides);

      try {
        if (ovSnap.exists()) {
          await updateDoc(doc(db, ovPath), {
            dayOverrides: cleanOverrides,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, ovPath), {
            ownerId: uid,
            companyId: compId,
            yearMonth: ov.yearMonth,
            targetId,
            dayOverrides: cleanOverrides,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, ovPath);
      }
    }
  }

  return {
    companies: totalCompanies,
    schedules: totalSchedules,
    employees: totalEmployees,
    holidays: totalHolidays,
  };
}
