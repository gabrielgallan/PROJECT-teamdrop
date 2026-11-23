export const htmlPageStyles = `
  :root {
    font-family: ui-sans-serif, system-ui, sans-serif;
    color-scheme: dark;
    color: #fafafa;
    background: #09090b;
    -webkit-font-smoothing: antialiased;
  }

  * {
    box-sizing: border-box;
  }

  body {
    display: grid;
    min-height: 100dvh;
    margin: 0;
    padding: 24px;
    place-items: center;
  }

  main {
    width: 100%;
    max-width: 420px;
    padding: 32px;
    border: 1px solid #27272a;
    border-radius: 7px;
    background: #18181b;
  }

  h1 {
    margin: 0 0 12px;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.5px;
  }

  p {
    margin: 0;
    color: #a1a1aa;
    font-size: 14px;
    line-height: 1.7;
  }

  .button {
    display: flex;
    min-height: 42px;
    margin-top: 24px;
    padding: 10px 16px;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    background: #6366f1;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
  }

  .button:hover {
    background: #4f46e5;
  }

  .button:focus-visible {
    outline: 2px solid #a5b4fc;
    outline-offset: 3px;
  }

  .muted {
    margin-top: 20px;
    color: #71717a;
    font-size: 12px;
  }

  .icon {
    display: grid;
    width: 44px;
    height: 44px;
    margin-bottom: 24px;
    padding: 10px;
    place-items: center;
    border: 1px solid transparent;
    border-radius: 7px;
    flex-shrink: 0;
  }

  .icon svg {
    display: block;
    width: 22px;
    height: 22px;
  }

  .icon-success {
    background: #312e81;
    border-color: #3730a3;
    color: #a5b4fc;
  }

  .icon-error {
    background: #450a0a;
    border-color: #7f1d1d;
    color: #fca5a5;
  }
`