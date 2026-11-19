import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Last line of defence: whatever goes wrong, the reader sees one calm sentence and a button.
 * WHY no error text: it could contain part of the message being checked, and messages are never
 * shown outside the result, logged or sent anywhere.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally empty: no console output, so nothing from the message can end up in a log.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-start gap-4 rounded-card bg-surface p-8 shadow-soft">
        <p className="font-heading text-2xl">Ceva nu a mers cum trebuie.</p>
        <p>Nu s-a pierdut nimic și nu s-a trimis nimic. Încercați din nou.</p>
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          className="min-h-14 rounded-card bg-ink px-6 font-semibold text-surface"
        >
          Încercați din nou
        </button>
      </div>
    );
  }
}
