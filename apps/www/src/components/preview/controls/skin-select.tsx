import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSkin, SKINS, useSkin } from "@/hooks/use-skin";

/** The skin a preview is drawn in, from its bar: kept for every preview that has more than one. */
export function SkinSelect() {
  const [skin, choose] = useSkin();
  const pick = useCallback(
    (next: unknown) => {
      if (isSkin(next)) {
        choose(next);
      }
    },
    [choose]
  );
  return (
    <Select onValueChange={pick} value={skin}>
      <SelectTrigger aria-label="Skin">
        <SelectValue>
          {({ value }) => SKINS.find((each) => each.id === value)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {SKINS.map((each) => (
            <SelectItem key={each.id} label={each.label} value={each.id}>
              {each.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
