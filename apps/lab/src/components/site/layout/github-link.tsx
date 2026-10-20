import { GithubLogoIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useGithubStars } from "@/hooks/use-github-stars";
import { SITE } from "@/lib/seo";

const OWNER = "ouestlabs";
const REPO = "audio-ui";

const compact = (count: number) =>
  count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);

/** The project's repository, and how many people starred it: as in the docs' header. */
export function GitHubLink() {
  const count = useGithubStars(OWNER, REPO);
  return (
    <ButtonGroup>
      <Button
        aria-label="audio/ui on GitHub"
        className="shadow-none"
        nativeButton={false}
        render={<a href={SITE.repository} rel="noreferrer" target="_blank" />}
        variant="outline"
      >
        <GithubLogoIcon aria-hidden="true" />
      </Button>
      <ButtonGroupText className="p-1">
        {count === null ? (
          <Skeleton className="h-5 w-6 rounded-sm border" />
        ) : (
          <span className="w-6 text-center text-muted-foreground text-xs tabular-nums">
            {compact(count)}
          </span>
        )}
      </ButtonGroupText>
    </ButtonGroup>
  );
}
