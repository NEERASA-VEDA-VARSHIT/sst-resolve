/**
 * Calculate ticket statistics
 */

type Ticket = {
  status: string | null;
  escalation_level: number | null;
};

export function calculateTicketStats(tickets: Ticket[]) {
  return {
    total: tickets.length,
    open: tickets.filter(t => (t.status || "").toLowerCase() === 'open').length,
    inProgress: tickets.filter(t => {
      const status = (t.status || "").toLowerCase();
      return status === 'in_progress' || status === 'escalated';
    }).length,
    awaitingStudent: tickets.filter(t => (t.status || "").toLowerCase() === 'awaiting_student_response').length,
    resolved: tickets.filter(t => {
      const status = (t.status || "").toLowerCase();
      return status === 'resolved' || status === 'closed';
    }).length,
    escalated: tickets.filter(t => (Number(t.escalation_level) || 0) > 0).length,
  };
}
