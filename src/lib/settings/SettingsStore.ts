type StorageArea = { get: (key: string) => Promise<Record<string, any>>; set: (items: Record<string, any>) => Promise<void> };

export class SettingsStore<T extends Record<string, any>> {
  protected _key: string;
  protected _areaKey: 'sync' | 'local';
  protected _data: T;
  protected _defaults: T;
  private _listeners = new Set<() => void>();
  private _persisting = false;
  private _onChangedUnsub: (() => void) | null = null;

  constructor(key: string, area: 'sync' | 'local', defaults: T) {
    this._key = key;
    this._areaKey = area;
    this._defaults = defaults;
    this._data = structuredClone(defaults);
    return this._createRootProxy();
  }

  private _getStorage(): { area: StorageArea; onChanged: { addListener: Function; removeListener: Function } } | null {
    for (const key of ['browser', 'chrome']) {
      try {
        const ns = (globalThis as any)[key];
        if (!ns) continue;
        const area = this._areaKey === 'local' ? ns.storage?.local : ns.storage?.sync;
        if (area?.get && area?.set && ns.storage?.onChanged) {
          return { area, onChanged: ns.storage.onChanged };
        }
      } catch { /* try next */ }
    }
    return null;
  }

  private get _area(): StorageArea | null {
    const s = this._getStorage();
    if (!s) return null;
    return s.area;
  }

  _listenStorage() {
    if (this._onChangedUnsub) return;
    const s = this._getStorage();
    if (!s) return;
    const handler = (changes: Record<string, any>, areaName: string) => {
      if (this._persisting) { this._persisting = false; return; }
      if (areaName === this._areaName && changes[this._key]) {
        const newVal = changes[this._key].newValue;
        if (newVal) {
          this._data = this._deepMerge(structuredClone(this._defaults), newVal);
          this._notify();
        }
      }
    };
    s.onChanged.addListener(handler);
    this._onChangedUnsub = () => s.onChanged.removeListener(handler);
  }

  async load() {
    const area = this._area;
    if (area) {
      try {
        const result = await area.get(this._key);
        const stored = result[this._key];
        if (stored) {
          this._data = this._deepMerge(structuredClone(this._defaults), stored);
          this._notify();
        }
      } catch (e) {
        console.warn(`SettingsStore[${this._key}]: load failed`, e);
      }
    } else {
      console.warn(`SettingsStore[${this._key}]: storage unavailable, using defaults`);
    }
    this._listenStorage();
  }

  get _areaName(): 'sync' | 'local' { return this._areaKey; }

  onChange(cb: () => void): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  protected _persist() {
    this._persisting = true;
    const area = this._area;
    if (area) {
      area.set({ [this._key]: this._data }).catch(console.error);
    }
    this._notify();
  }

  private _notify() {
    this._listeners.forEach(cb => cb());
  }

  private _deepMerge(target: any, source: any): any {
    for (const key of Object.keys(source)) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this._deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  private _createRootProxy(): T {
    const self = this;
    return new Proxy(self, {
      get(_, prop) {
        if (typeof prop === 'string' && (prop === 'then' || prop === 'toJSON')) {
          return (self as any)[prop];
        }
        if (prop in self || (typeof prop === 'string' && prop.startsWith('_'))) {
          return (self as any)[prop];
        }
        const value = self._data[prop as string];
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          return self._createDataProxy(value, [prop as string]);
        }
        return value;
      },
      set(_, prop, value) {
        if (typeof prop === 'string' && !prop.startsWith('_')) {
          (self._data as any)[prop] = value;
          self._persist();
          return true;
        }
        (self as any)[prop] = value;
        return true;
      },
      has(_, prop) {
        if (prop in self || (typeof prop === 'string' && prop.startsWith('_'))) return true;
        return prop in self._data;
      },
    }) as unknown as T;
  }

  private _createDataProxy(obj: any, _path: string[]): any {
    const self = this;
    return new Proxy(obj, {
      get(target, prop) {
        if (prop === 'toJSON') return () => target;
        const value = Reflect.get(target, prop);
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          return self._createDataProxy(value, [..._path, prop as string]);
        }
        return value;
      },
      set(target, prop, value) {
        Reflect.set(target, prop, value);
        self._persist();
        return true;
      },
    });
  }
}
