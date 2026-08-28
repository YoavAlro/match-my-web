import sourceDocument from "../web/index.html?raw";

const bodyMatch = sourceDocument.match(/<body>([\s\S]*?)<\/body>/i);
if (!bodyMatch?.[1]) throw new Error("Tweaksy Live source is missing its body content.");
const bodyMarkup = bodyMatch[1];

export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: bodyMarkup }} />
      <script type="module" src="/app.js" />
    </>
  );
}
