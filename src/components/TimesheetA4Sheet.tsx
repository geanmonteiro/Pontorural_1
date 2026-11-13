import React from 'react';
import {
  Company,
  Employee,
  GeneratedDayRow,
  PrintCalibration,
  Schedule,
} from '../types/timesheet';
import { formatDateBr, formatMonthYearPt } from '../utils/holidays';

interface TimesheetA4SheetProps {
  company: Company;
  employee: Employee;
  schedule?: Schedule;
  year: number;
  month: number;
  rows: GeneratedDayRow[];
  calibration: PrintCalibration;
  interactive?: boolean;
  selectedDayKey?: string | null;
  onDayClick?: (row: GeneratedDayRow) => void;
}

export const TimesheetA4Sheet: React.FC<TimesheetA4SheetProps> = ({
  company,
  employee,
  schedule,
  year,
  month,
  rows,
  calibration,
  interactive = false,
  selectedDayKey = null,
  onDayClick,
}) => {
  const monthYearLabel = formatMonthYearPt(year, month);
  const admissionLabel = formatDateBr(employee.admissionDate);
  const scheduleDesc = schedule?.descriptionText || '07:00 AS 12:00 / 13:00 AS 17:00';

  const headerCellStyle: React.CSSProperties = {
    fontSize: `${calibration.headerFontPt}pt`,
    lineHeight: 1.25,
    padding: '2.5px 5px',
    textAlign: 'left',
    verticalAlign: 'middle',
  };

  const thStyle: React.CSSProperties = {
    fontSize: `${calibration.tableFontPt}pt`,
    lineHeight: 1.15,
    padding: '2px 2px',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontWeight: 400,
  };

  const tdStyleBase: React.CSSProperties = {
    fontSize: `${calibration.tableFontPt}pt`,
    height: `${calibration.rowHeightMm}mm`,
    padding: '0 2px',
    textAlign: 'center',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      className="a4-sheet-wrapper bg-white shadow-sm border border-slate-300 print:border-none print:shadow-none"
      style={{ width: '210mm' }}
    >
      <div
        className="a4-sheet"
        style={{
          paddingTop: `${calibration.marginTopMm}mm`,
          paddingBottom: `${calibration.marginBottomMm}mm`,
          paddingLeft: `${calibration.marginSideMm}mm`,
          paddingRight: `${calibration.marginSideMm}mm`,
        }}
      >
        {/* Bloco de Cabeçalho idêntico ao PDF anexo */}
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '58%' }} />
            <col style={{ width: '42%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={2} style={{ ...headerCellStyle, fontWeight: 700 }}>
                EMPREGADOR: {company.name} - {company.cnpj}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={headerCellStyle}>
                Endereço: {company.address}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ ...headerCellStyle, fontWeight: 700 }}>
                Nome do Empregado: {employee.name}
              </td>
            </tr>
            <tr>
              <td style={headerCellStyle}>Cargo: {employee.role}</td>
              <td style={headerCellStyle}>CPF: {employee.cpf}</td>
            </tr>
            <tr>
              <td style={headerCellStyle}>
                Nº de Registro do Empregado: {employee.registrationNumber}
              </td>
              <td style={headerCellStyle}>Admissão: {admissionLabel}</td>
            </tr>
            <tr>
              <td colSpan={2} style={headerCellStyle}>
                Jornada de Trabalho: {scheduleDesc}
              </td>
            </tr>
            <tr>
              <td
                colSpan={2}
                style={{
                  ...headerCellStyle,
                  fontWeight: 700,
                  borderBottom: '1px solid #000000',
                }}
              >
                MÊS E ANO: {monthYearLabel}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Grade Principal de 15 colunas idêntica ao PDF anexo */}
        <table style={{ tableLayout: 'fixed', width: '100%', marginTop: '-1px' }}>
          <colgroup>
            <col style={{ width: '4.2%' }} />
            <col style={{ width: '4.8%' }} />
            <col style={{ width: '7.2%' }} />
            <col style={{ width: '7.2%' }} />
            <col style={{ width: '5.2%' }} />
            <col style={{ width: '5.2%' }} />
            <col style={{ width: '5.2%' }} />
            <col style={{ width: '5.2%' }} />
            <col style={{ width: '7.2%' }} />
            <col style={{ width: '7.2%' }} />
            <col style={{ width: '5.2%' }} />
            <col style={{ width: '5.2%' }} />
            <col style={{ width: '5.2%' }} />
            <col style={{ width: '5.2%' }} />
            <col style={{ width: '20.6%' }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={thStyle}>
                Dia
              </th>
              <th rowSpan={2} style={thStyle}>
                Dia
              </th>
              <th colSpan={4} rowSpan={2} style={thStyle}>
                MANHÃ
              </th>
              <th colSpan={4} rowSpan={2} style={thStyle}>
                TARDE
              </th>
              <th colSpan={4} style={thStyle}>
                Horas Extras
              </th>
              <th rowSpan={3} style={thStyle}>
                Assinatura do Empregado
              </th>
            </tr>
            <tr>
              <th colSpan={2} style={thStyle}>
                MANHÃ
              </th>
              <th colSpan={2} style={thStyle}>
                TARDE
              </th>
            </tr>
            <tr>
              <th style={thStyle}>Mês</th>
              <th style={thStyle}>Sem</th>
              <th style={thStyle}>Entrada</th>
              <th style={thStyle}>Saída</th>
              <th style={thStyle}>Entrada</th>
              <th style={thStyle}>Saída</th>
              <th style={thStyle}>Entrada</th>
              <th style={thStyle}>Saída</th>
              <th style={thStyle}>Entrada</th>
              <th style={thStyle}>Saída</th>
              <th style={thStyle}>Entrada</th>
              <th style={thStyle}>Saída</th>
              <th style={thStyle}>Entrada</th>
              <th style={thStyle}>Saída</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = interactive && selectedDayKey === row.dayKey;
              return (
                <tr
                  key={row.dayKey}
                  onClick={interactive && onDayClick ? () => onDayClick(row) : undefined}
                  title={
                    interactive
                      ? row.holidayName
                        ? `${row.dayKey} (${row.weekdayShort}) — ${row.holidayName}. Clique para editar este dia.`
                        : `${row.dayKey} (${row.weekdayShort}) — Clique para editar este dia.`
                      : undefined
                  }
                  className={[
                    row.shaded ? 'a4-row-shaded' : '',
                    interactive ? 'cursor-pointer transition-colors hover:outline hover:outline-1 hover:outline-emerald-700' : '',
                    isSelected ? 'ring-2 ring-inset ring-emerald-700' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td style={tdStyleBase}>{row.dayKey}</td>
                  <td style={tdStyleBase}>{row.weekdayShort}</td>
                  <td style={tdStyleBase} />
                  <td style={tdStyleBase} />
                  <td style={tdStyleBase}>{row.col5Text}</td>
                  <td style={tdStyleBase}>{row.col6Text}</td>
                  <td style={tdStyleBase}>{row.col7Text}</td>
                  <td style={tdStyleBase} />
                  <td style={tdStyleBase} />
                  <td style={tdStyleBase} />
                  <td style={tdStyleBase} />
                  <td style={tdStyleBase} />
                  <td style={tdStyleBase} />
                  <td style={tdStyleBase} />
                  <td style={tdStyleBase} />
                </tr>
              );
            })}

            {/* Bloco inferior de Assinatura idêntico ao PDF anexo */}
            <tr>
              <td
                colSpan={10}
                style={{
                  height: '13mm',
                  verticalAlign: 'bottom',
                  textAlign: 'center',
                  paddingBottom: '2.5px',
                }}
              >
                <div
                  style={{
                    width: '66%',
                    margin: '0 auto 2px auto',
                    borderTop: '1px solid #000000',
                  }}
                />
                <div
                  style={{
                    fontSize: `${calibration.headerFontPt}pt`,
                    fontWeight: 700,
                    letterSpacing: '0.01em',
                  }}
                >
                  ASSINATURA DO EMPREGADO
                </div>
              </td>
              <td colSpan={5} style={{ height: '13mm' }} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
