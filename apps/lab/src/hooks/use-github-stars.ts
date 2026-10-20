import { useEffect, useState } from "react";

/** The counts already asked for, so every mount of the link shares one request. */
const asked = new Map<string, Promise<number>>();

function stars(owner: string, repo: string) {
  const key = `${owner}/${repo}`;
  let request = asked.get(key);
  if (!request) {
    request = fetch(`https://api.github.com/repos/${key}`).then(
      async (response) => {
        if (!response.ok) {
          throw new Error("The stargazers could not be counted");
        }
        const data: { stargazers_count: number } = await response.json();
        return data.stargazers_count;
      }
    );
    asked.set(key, request);
  }
  return request;
}

/** How many stars a repository has: `null` while it is being asked, or if GitHub does not answer. */
export function useGithubStars(owner: string, repo: string) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let current = true;
    stars(owner, repo)
      .then((value) => {
        if (current) {
          setCount(value);
        }
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [owner, repo]);

  return count;
}
