/* ------------------------------------------------------------------ */
/*  SigFlow – Shared Sidebar Styling                                   */
/* ------------------------------------------------------------------ */

export const accordionSx = {
  '&:before': { display: 'none' },
  borderBottom: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
} as const;

export const summarySx = {
  '&:hover': { bgcolor: 'action.hover' },
  minHeight: 44,
  '& .MuiAccordionSummary-content': { my: 0.75 },
} as const;
