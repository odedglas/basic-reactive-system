import { Callback, Effect, SignalNode } from './types';

const runningEffects: Effect[] = [];
let Updates: Effect[];

const getRunningEffect = () => runningEffects[runningEffects.length - 1];

const flushUpdates = () => {
    let flushedIndex = 0;
    while (Updates.length !== 0 && flushedIndex !== Updates.length) {
        let effect = Updates[flushedIndex];
        if (effect) {
            runEffect(effect);
            flushedIndex++;
        }
    }

    Updates = undefined;
};

const runUpdates = (fn: Callback) => {
    if (Updates) {
        return fn();
    }

    Updates = [];
    fn();
    flushUpdates();
};

const runEffect = (effect: Effect) => {
    cleanup(effect);

    runningEffects.push(effect);

    try {
        runUpdates(effect.fn);
    } finally {
        runningEffects.pop();
    }
};

function trackEffectDependency(effect: Effect, signal: SignalNode) {
    signal.observers.add(effect);

    effect.dependencies.add(signal);
}

export function createSignal<T>(value?: T): [
    () => T,
    (value: T) => void
] {
    const signal: SignalNode = {
        current: value,
        observers: new Set()
    };

    const read = (): T => {
        const effect = getRunningEffect();

        if (effect) trackEffectDependency(effect, signal);

        return signal.current as T;
    };

    const write = (nextValue: T) => {
        signal.current = nextValue;

        if (signal.observers.size) {
            runUpdates(() => {
                for (const observer  of [...signal.observers]) {
                    if (!observer.state) {
                        observer.state = 'pending'
                        Updates.push(observer);
                    }
                }
            })
        }
    };
    return [read, write];
}

export function cleanup(effect: Effect) {
    for (const dep of effect.dependencies) {
        dep.observers.delete(effect);
    }

    if (effect.owned) {
        effect.owned?.forEach((ownedEffect) => {
            cleanup(ownedEffect);
        });

        effect.owned = [];
    }

    delete effect.state;
    effect.dependencies.clear();
}

export function createEffect(fn: Callback) {
    const owner = getRunningEffect();

    const effect: Effect = {
        run: () => runEffect(effect),
        dependencies: new Set(),
        fn,
        owner
    };

    if (owner) {
        owner.owned ||= [];
        owner.owned.push(effect);
    }

    runEffect(effect);
}

export function createMemo(fn: Callback) {
    const [memoReadOnlySignal, set] = createSignal();
    createEffect(() => set(fn()));
    return memoReadOnlySignal;
}

export function batch(fn: Callback) {
    runUpdates(fn);
}
