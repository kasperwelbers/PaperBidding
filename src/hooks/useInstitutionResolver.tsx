import { useEffect, useState } from "react";

export interface InstitutionData {
  byDomain: Record<string, string>;
  keywords: { university: string; keywords: string[] }[];
}

export interface InstitutionResolver {
  ready: boolean;
  resolve: (email: string, institution: string) => string;
}

export default function useInstitutionResolver() {
  const [resolver, setResolver] = useState<InstitutionResolver>({
    ready: false,
    resolve: () => "",
  });

  useEffect(() => {
    const getData = async () => {
      const res = await fetch("/institution_domains.json");
      const byDomain: Record<string, string> = await res.json();

      const keywords = Object.values(byDomain).map((university) => {
        return {
          university,
          keywords: getKeywords(university),
        };
      });

      const f = (email: string, institution: string) => {
        return getInstitution(email, institution, { byDomain, keywords });
      };

      setResolver({
        ready: true,
        resolve: f,
      });
    };
    getData();
  }, []);

  return resolver;
}

function getKeywords(institution: string) {
  // remove words like university school college
  // replace multiple spaces with single spaces

  return normalizeUniName(institution)
    .split(/ |,/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}

async function getUniversityDomains() {
  // read file "university_domains.json" from public folder
  // just write the code stupid copilot

  const response = await fetch("university_domains.json");
  return await response.json();
}

export function getInstitution(
  email: string,
  institution: string,
  institutionData: InstitutionData,
) {
  const emailDomain = email.split("@")[1];

  const fromDomain = institutionData.byDomain[emailDomain];
  if (fromDomain) return fromDomain;

  const li = normalizeUniName(institution)
    .split(/ |,/)
    .map((x) => x.trim());
  kw_loop: for (let { university, keywords } of institutionData.keywords) {
    // all keywords must occur. break if one doesn't

    for (let kw of keywords) {
      if (!li.includes(kw)) continue kw_loop;
    }

    return university;
  }

  return institution.split(",")?.[1]?.trim() || institution;
}

function normalizeUniName(name: string) {
  // replace a standalone u with university
  return name.toLowerCase().replace(/\b(u)\b/g, "university");
}
