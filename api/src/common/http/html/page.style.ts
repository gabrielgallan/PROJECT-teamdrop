export const htmlPageStyles = `
  :root {
    font-family: ui-sans-serif, system-ui, sans-serif;
    color-scheme: dark;
    color: #fafafa;
    background: #18181b;
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
    max-width: 400px;
    padding: 24px 0;
    text-align: center;
  }

  .brand {
    display: flex;
    margin-bottom: 40px;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #fafafa;
    font-size: 30px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .brand img {
    display: block;
    flex-shrink: 0;
    filter: invert(1);
  }

  h1 {
    margin: 0 0 12px;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1.2;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
    color: #a1a1aa;
    font-size: 14px;
    line-height: 1.7;
    text-wrap: pretty;
  }

  .button {
    display: inline-flex;
    min-height: 44px;
    margin-top: 24px;
    padding: 10px 20px;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    background: #818cf8;
    color: #09090b;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }

  .button:hover {
    background: #a5b4fc;
  }

  .button:active {
    background: #6366f1;
  }

  .button:focus-visible {
    outline: 2px solid #a5b4fc;
    outline-offset: 3px;
  }

  .muted,
  .help-text {
    max-width: 36ch;
    margin: 24px auto 0;
    color: #a1a1aa;
    font-size: 12px;
  }

  .icon {
    display: grid;
    width: 32px;
    height: 32px;
    margin: 0 auto 16px;
    place-items: center;
  }

  .icon svg {
    display: block;
    width: 30px;
    height: 30px;
  }

  .icon-success {
    color: #a5b4fc;
  }

  .icon-error {
    color: #fca5a5;
  }
`
