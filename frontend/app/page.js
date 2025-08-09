import ChatInputBox from "./_components/ChatInputBox";

export default function Home() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-10 pt-20">
      <div className="flex flex-col items-center gap-4">
        <img src="/kl1.png" alt="KnowledgeLink" width={120} height={120} />
        <h1 className="text-4xl sm:text-5xl font-semibold">KnowledgeLink</h1>
        
      </div>
      <div className="w-full px-4">
    <ChatInputBox />
      </div>
  </div>
  );
}
