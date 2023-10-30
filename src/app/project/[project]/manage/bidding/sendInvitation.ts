export async function sendInvitation(
  projectId: number,
  email: string,
  firstname: string,
  link: string,
  text1: string,
  text2: string
) {
  const response = await fetch(`/api/project/${projectId}/invitation`, {
    body: JSON.stringify({
      to: email,
      html: createHTML(firstname, link, text1, text2)
    }),
    headers: {
      Authorization: `${process.env.MIDDLECAT_MAIL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  return response.ok;
}

export function createHTML(firstname: string, url: string, text1: string, text2: string) {
  return `
<p>Dear ${firstname},</p>

${text1
  .split('\n\n')
  .map((line) => `<p>${line}</p>`)
  .join('\n')}

<h4>Please use <a href="${url}">this link right here</a> to start the paper bidding</h4>

${text2
  .split('\n\n')
  .map((line) => `<p>${line}</p>`)
  .join('\n')}
`;
}
