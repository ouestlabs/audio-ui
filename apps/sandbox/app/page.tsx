import BlockPlayer from "@/components/audio/blocks/block-player";
import { AudioProvider } from "@/components/audio/provider";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-svh w-full max-w-3xl flex-col items-center justify-center px-16 py-32">
        <AudioProvider>
          <BlockPlayer />
        </AudioProvider>
      </main>
    </div>
  );
}
