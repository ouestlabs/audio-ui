import type { MDXComponents } from "mdx/types";
import { ComponentsList } from "@/components/components-list";
import { Callout } from "@/components/md/callout";
import { CodeTabs, Collapse } from "@/components/md/code";
import { H1, H2, H3, H4, H5, H6 } from "@/components/md/heading";
import { Code, Figcaption, Figure, Pre } from "@/components/md/inline";
import { Link } from "@/components/md/link";
import { ListItem, OrderedList, UnorderedList } from "@/components/md/list";
import { HorizontalRule, Image, Img } from "@/components/md/media";
import { Mermaid } from "@/components/md/mermaid";
import { Preview, Source } from "@/components/md/preview";
import { Step, Steps } from "@/components/md/steps";
import {
  Tab,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/md/tabs";
import { Blockquote, Paragraph, Strong } from "@/components/md/text";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/default/ui/table";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    h1: H1,
    h2: H2,
    h3: H3,
    h4: H4,
    h5: H5,
    h6: H6,
    a: Link,
    p: Paragraph,
    strong: Strong,
    ul: UnorderedList,
    ol: OrderedList,
    li: ListItem,
    blockquote: Blockquote,
    img: Img,
    hr: HorizontalRule,
    table: (props: React.ComponentProps<"table">) => (
      <div className="no-scrollbar my-6 w-full overflow-y-auto rounded-4xl border bg-card">
        <Table {...props} />
      </div>
    ),
    thead: TableHeader,
    tbody: TableBody,
    tfoot: TableFooter,
    tr: TableRow,
    th: TableHead,
    td: TableCell,
    caption: TableCaption,
    pre: Pre,
    figure: Figure,
    figcaption: Figcaption,
    code: Code,
    Step,
    Steps,
    Image,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Tab,
    Callout,
    CodeTabs,
    Preview,
    Source,
    Collapse,
    ComponentsList,
    Mermaid,
    ...components,
  };
}
