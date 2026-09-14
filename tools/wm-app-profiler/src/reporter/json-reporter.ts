import { FullAuditReport } from '../types.js';

export function generateJsonReport(report: FullAuditReport): string {
  return JSON.stringify(report, null, 2);
}
