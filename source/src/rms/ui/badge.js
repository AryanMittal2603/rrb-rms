import { h } from '../core/h.js';
import { L } from '../i18n.js';

// Status -> tone. Tones map to AMS colours (success green, danger red, warning orange, info teal, purple).
const TONES = {
  success: ['In panel', 'DV completed', 'Shortlisted for DV', 'Approved by RRB', 'Approved by Nodal RRB', 'Approved by CPO', 'Compiled for CEN', 'Consolidated', 'Recommended', 'Fit', 'Joined', 'Active', 'Acknowledged by ECA', 'Imported', 'Delivered', 'Closed', 'Cleared', 'Completed', 'Matched', 'Verified', 'Approved by Chairperson', 'Final', 'Distributed to units', 'Accepted by unit', 'Operational', 'In sync', 'OK', 'Reviewed by RRB', 'Approved', 'Compliant', 'Low', 'Examined', 'Present', 'Accepted', 'Published', 'Medically fit', 'Sent for CEN processing', 'Panel & joining', 'Handed over', 'Resolved', 'Ready'],
  danger: ['Removed from panel', 'Candidature withheld', 'DV not recommended', 'DV absent', 'Medical absent', 'Returned to maker', 'Returned by CPO', 'Returned to CPO', 'Returned by Nodal RRB', 'Returned by RRB', 'Not recommended', 'Unfit', 'Failed', 'Validation failed', 'Absent', 'Not joined', 'Rejected', 'Non-compliant', 'High', 'Escalated', 'Rejected by Chairperson', 'Revoked', 'Debar list match', 'Medically unfit', 'Down', 'Rejected (validation)', 'Not matched'],
  warning: ['DV escalated', 'Medical referred', 'Submitted to CPO', 'Submitted to RRB', 'Resubmitted to CPO', 'Escalated to MS', 'Temporarily unfit', 'Pending', 'Awaiting RRB', 'Under review', 'Open', 'Pending checker', 'Pending final approval', 'Partially compliant', 'Medium', 'Degraded', 'Retry', 'Submitted to MS', 'Approved by MS', 'Offer issued', 'Reopened', 'Pending with RRB Admin', 'Due — prepare offline package', 'Submitted to Chairperson', 'In compilation', 'Referred to debar', 'Under inquiry', 'Provisional'],
  info: ['DV scheduled', 'Result declared', 'Scheduled', 'Referred', 'Sent', 'Assigned', 'Responded', 'Allocated to CPO', 'Sent to HMIS', 'Created by CPO', 'In progress', 'Submitted', 'New', 'DV & medical', 'CBT in progress', 'Indenting', 'CEN processing', 'Awaiting acknowledgement', 'Shortlisted'],
  neutral: ['Draft', 'Expired', 'Not due', 'Not attempted', 'NA', 'Inactive', 'Superseded'],
};
const MAP = {};
for (const tone in TONES) TONES[tone].forEach((s) => { MAP[s] = tone; });

export function tone(status) { return MAP[status] || 'purple'; }

export function badge(status, label) {
  return h('span.rms-badge.rms-badge--' + tone(status), label || statusText(status));
}

export function pill(text, t) {
  return h('span.rms-badge.rms-badge--' + (t || 'purple'), text);
}

// Status values are data; this keeps them translatable without changing stored values.
export function statusText(s) {
  return s ? L('status.' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), s) : '—';
}
