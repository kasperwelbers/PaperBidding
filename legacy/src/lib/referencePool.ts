/** ID of the project that holds the central ICA reference submissions, set
 *  with the REFERENCE_POOL_PROJECT_ID env variable. Planners can copy these
 *  submissions into their project as reference submissions (Step 3) */
export function referencePoolProjectId(): number | null {
  const id = Number(process.env.REFERENCE_POOL_PROJECT_ID);
  return Number.isInteger(id) && id > 0 ? id : null;
}
