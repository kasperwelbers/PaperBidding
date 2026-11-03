/** The ICA submission system (where reviewers register) for next year's conference.
 *  Paper bidding happens in the fall, for the conference of the following year */
export function defaultRegistrationUrl(date: Date = new Date()) {
  return `https://ica${date.getFullYear() + 1}.abstractcentral.com/`;
}
