// Allow importing CSS files directly (e.g. `import './index.css'`)
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
