export interface Owner {
    owner?: Owner;
    owned?: Effect[];
}

export interface SignalNode {
    current: unknown
    observers: Set<Effect>
}

export interface Effect extends Owner {
    run: () => void;
    fn?: () => void;
    dependencies: Set<SignalNode>;
    state?: string
}


export type Callback = () => unknown;
