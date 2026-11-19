// Only the Chrome extension APIs this extension calls. Hand-written so the repo needs no extra dependency.
declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: { id?: number };
    }
    function sendMessage<T>(message: unknown): Promise<T>;
    const onMessage: {
      addListener(
        callback: (message: unknown, sender: MessageSender, sendResponse: (response: unknown) => void) => boolean | undefined,
      ): void;
    };
  }
  namespace action {
    function setBadgeText(details: { text: string; tabId?: number }): Promise<void>;
    function setBadgeBackgroundColor(details: { color: string; tabId?: number }): Promise<void>;
  }
  namespace notifications {
    function create(
      id: string,
      options: { type: 'basic'; iconUrl: string; title: string; message: string; priority?: number },
    ): Promise<string>;
  }
  namespace storage {
    interface Area {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    }
    const local: Area;
    const session: Area;
  }
  namespace permissions {
    function request(p: { origins: string[] }): Promise<boolean>;
  }
}
