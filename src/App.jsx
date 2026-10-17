import MermaidView from "./components/MermaidView";
import AudioPlayer from "./components/AudioPlayer";
import Flashcards from "./components/Flashcards";
import { mock } from "./mockData";

export default function App() {
  return (
    <div style={{ padding: 24 }}>
      <MermaidView code={mock.mermaid} />
      <AudioPlayer text={mock.simplified} />
      <Flashcards cards={mock.flashcards} />
    </div>
  );
}