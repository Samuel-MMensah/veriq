import { SampleDataTag } from "./SampleDataTag";

type Props = {
  title: string;
  screen: number;
  /** Prompt that builds the real screen. */
  prompt: number;
  /** True when the finished screen shows hospital data (rule 1). */
  sampleData?: boolean;
  children?: React.ReactNode;
};

export function ScreenPlaceholder({ title, screen, prompt, sampleData = false, children }: Props) {
  return (
    <main className="px-4 pt-6 pb-4">
      {sampleData && <SampleDataTag className="mb-3" />}
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        Screen {screen}. This page is a placeholder. Prompt {prompt} builds it.
      </p>
      {children}
    </main>
  );
}
