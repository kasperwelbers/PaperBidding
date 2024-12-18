export async function sendInvitation(
  projectId: number,
  email: string,
  link: string,
  text1: string,
  text2: string,
  division: string,
  test?: boolean,
) {
  const testLink = link.split("/bidding/")[0] + "/test";

  const response = await fetch(`/api/projects/${projectId}/invitation`, {
    body: JSON.stringify({
      to: email,
      html: createHTML(test ? testLink : link, text1, text2),
      division: division,
      test,
    }),
    headers: {
      Authorization: `${process.env.MIDDLECAT_MAIL_TOKEN}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return response.ok;
}

export function createHTML(url: string, text1: string, text2: string) {
  return `
${text1
  .split("\n\n")
  .map((line) => `<p>${line}</p>`)
  .join("\n")}

<h4>Please use <a href="${url}">this link right here</a> to start the paper bidding</h4>

${text2
  .split("\n\n")
  .map((line) => `<p>${line}</p>`)
  .join("\n")}
`;
}
