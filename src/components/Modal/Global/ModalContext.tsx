import Log from '@libs/Log';

import CONST from '@src/CONST';

import noop from 'lodash/noop';
import React, {useContext, useEffect, useRef, useState} from 'react';

const ModalActions = {
    CONFIRM: 'CONFIRM',
    CLOSE: 'CLOSE',
} as const;

type ModalAction = (typeof ModalActions)[keyof typeof ModalActions];

type ModalStateChangePayload<A extends ModalAction = ModalAction> = {action: A};

type ModalProps = {
    closeModal: (param?: ModalStateChangePayload) => Promise<void>;
    resolveModal: (param?: ModalStateChangePayload) => void;
    removeModal: () => void;
    // Whether the modal is currently animating out. Rendered modals should treat this like being hidden.
    isHiding?: boolean;
};

type ModalContextType = {
    showModal<P extends ModalProps>(options: {
        component: React.FunctionComponent<P>;
        props?: Omit<P, keyof ModalProps>;
        id?: string;
        isCloseable?: boolean;
    }): Promise<ModalStateChangePayload>;
    closeModal(data?: ModalStateChangePayload): Promise<void>;
    resolveModal(data?: ModalStateChangePayload): void;
    removeModal(): void;
};

const ModalContext = React.createContext<ModalContextType>({
    showModal: () => Promise.resolve({action: 'CLOSE'}),
    closeModal: () => Promise.resolve(),
    resolveModal: noop,
    removeModal: noop,
});

const useModal = () => useContext(ModalContext);

type ModalInfo = {
    id: string;
    component: React.FunctionComponent<ModalProps>;
    props?: Record<string, unknown>;
    isCloseable: boolean;
    // Set once the modal starts animating out; the entry is removed from the stack when the animation completes.
    isHiding?: boolean;
};

type CloseModalPromiseWithResolvers = ReturnType<typeof Promise.withResolvers<ModalStateChangePayload>>;

function ModalProvider({children}: {children: React.ReactNode}) {
    const [modalStack, setModalStack] = useState<{modals: ModalInfo[]}>({modals: []});
    const modalIDRef = useRef(1);
    const modalPromisesStack = useRef<Record<string, CloseModalPromiseWithResolvers>>({});
    // Promises returned by `closeModal`, resolved once the corresponding modal has finished hiding and is removed from the stack.
    const removeModalPromisesStack = useRef<Record<string, ReturnType<typeof Promise.withResolvers<void>>>>({});

    // We use a ref because `resolveModal` is called on demand, so it doesn't need to re-render whenever `modalStack` changes.
    // This keeps the `ModalContext.Provider` value stable and prevents unnecessary updates, avoiding an infinite re-render loop (#96411).
    const modalStackRef = useRef(modalStack);
    useEffect(() => {
        modalStackRef.current = modalStack;
    }, [modalStack]);

    const showModal: ModalContextType['showModal'] = ({component, props, id, isCloseable = true}) => {
        // This is a promise that will resolve when the modal is closed
        let closeModalPromise: CloseModalPromiseWithResolvers | null = id ? modalPromisesStack.current?.[id] : null;

        const modalID = id ?? String(modalIDRef.current++);

        if (!closeModalPromise) {
            // Create a new promise with resolvers to be resolved when the modal is closed
            const promiseWithResolvers = Promise.withResolvers<ModalStateChangePayload>();
            closeModalPromise = promiseWithResolvers;

            // New modal => update modals stack
            setModalStack((prevState) => ({
                ...prevState,
                modals: [...prevState.modals, {component: component as React.FunctionComponent<ModalProps>, props, isCloseable, id: modalID}],
            }));
            modalPromisesStack.current[modalID] = closeModalPromise;
        } else {
            // If it is an existing modal, update props in place instead of stacking a new modal
            setModalStack((prevState) => {
                const modals = prevState.modals.map((modal) => {
                    if (modal.id === id) {
                        return {component: component as React.FunctionComponent<ModalProps>, props, isCloseable, id: modalID};
                    }
                    return modal;
                });
                return {...prevState, modals};
            });
        }

        return closeModalPromise.promise;
    };

    // Resolves the modal promise without closing the modal
    // Used for async confirmation flows where the modal stays open with loading state
    const resolveModal: ModalContextType['resolveModal'] = (data = {action: ModalActions.CONFIRM}) => {
        const lastModalId = modalStackRef.current.modals.at(-1)?.id;

        if (!lastModalId) {
            return;
        }

        const lastModalPromise = modalPromisesStack.current?.[lastModalId];
        if (lastModalPromise) {
            lastModalPromise.resolve(data);
            delete modalPromisesStack.current[lastModalId];
        }
    };

    // Starts hiding the top modal: it resolves the modal promise (no-op if already resolved by resolveModal),
    // marks the entry as hiding so it animates out, and returns a promise that settles once the entry is removed
    // (in removeModal, after the exit animation). This lets callers sequence one modal cleanly after another.
    const closeModal: ModalContextType['closeModal'] = (data = {action: ModalActions.CLOSE}) => {
        const lastModalId = modalStackRef.current.modals.at(-1)?.id;

        if (!lastModalId) {
            Log.alert(`${CONST.ERROR.ENSURE_BUG_BOT} Empty modals stack while attempting to close one. This should never happen.`);
            return Promise.resolve();
        }

        // Resolve the modal promise. If it was already resolved by resolveModal (async confirmation flow), this is a no-op.
        resolveModal(data);

        let removeModalPromise = removeModalPromisesStack.current[lastModalId];
        if (!removeModalPromise) {
            removeModalPromise = Promise.withResolvers<void>();
            removeModalPromisesStack.current[lastModalId] = removeModalPromise;
        }

        // Mark the top modal as hiding instead of slicing it out immediately, so the exit animation can play.
        setModalStack((prevState) => ({
            ...prevState,
            modals: prevState.modals.map((modal, index) => (index === prevState.modals.length - 1 ? {...modal, isHiding: true} : modal)),
        }));

        return removeModalPromise.promise;
    };

    // Removes the top modal from the stack once it has finished hiding, and settles the promise returned by closeModal.
    const removeModal: ModalContextType['removeModal'] = () => {
        const lastModalId = modalStackRef.current.modals.at(-1)?.id;

        setModalStack((prevState) => ({
            ...prevState,
            modals: prevState.modals.slice(0, -1),
        }));

        if (!lastModalId) {
            return;
        }

        const removeModalPromise = removeModalPromisesStack.current[lastModalId];
        if (removeModalPromise) {
            removeModalPromise.resolve();
            delete removeModalPromisesStack.current[lastModalId];
        }
    };

    const modalToRender = modalStack.modals.length > 0 ? modalStack.modals.at(modalStack.modals.length - 1) : null;
    const ModalComponent = modalToRender?.component;

    return (
        <ModalContext.Provider value={{showModal, closeModal, resolveModal, removeModal}}>
            {children}
            {!!ModalComponent && (
                <ModalComponent
                    {...modalToRender.props}
                    key={modalToRender.id}
                    isHiding={modalToRender.isHiding}
                    closeModal={closeModal}
                    resolveModal={resolveModal}
                    removeModal={removeModal}
                />
            )}
        </ModalContext.Provider>
    );
}

export type {ModalProps};
export {ModalProvider, useModal, ModalActions};
