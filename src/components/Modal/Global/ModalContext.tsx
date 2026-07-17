import Log from '@libs/Log';

import CONST from '@src/CONST';

import noop from 'lodash/noop';
import React, {useContext, useRef, useState} from 'react';

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

    /** Whether the modal is being hidden and should play its exit animation before it is removed from the stack */
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
    isHiding?: boolean;
};

type CloseModalPromiseWithResolvers = ReturnType<typeof Promise.withResolvers<ModalStateChangePayload>>;
type RemoveModalPromiseWithResolvers = ReturnType<typeof Promise.withResolvers<void>>;

function ModalProvider({children}: {children: React.ReactNode}) {
    const [modalStack, setModalStack] = useState<{modals: ModalInfo[]}>({modals: []});
    const modalIDRef = useRef(1);
    const modalPromisesStack = useRef<Record<string, CloseModalPromiseWithResolvers>>({});
    const removeModalPromisesStack = useRef<Record<string, RemoveModalPromiseWithResolvers>>({});

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
        const lastModalId = modalStack.modals.at(-1)?.id;

        if (!lastModalId) {
            return;
        }

        const lastModalPromise = modalPromisesStack.current?.[lastModalId];
        if (lastModalPromise) {
            lastModalPromise.resolve(data);
            delete modalPromisesStack.current[lastModalId];
        }
    };

    // Hides the modal instead of removing it from the stack right away, so that it can play its exit animation and unmount cleanly.
    // The returned promise resolves once the modal has finished hiding and its entry has been removed via removeModal.
    const closeModal: ModalContextType['closeModal'] = (data = {action: ModalActions.CLOSE}) => {
        const lastModalId = modalStack.modals.at(-1)?.id;

        if (!lastModalId) {
            Log.alert(`${CONST.ERROR.ENSURE_BUG_BOT} Empty modals stack while attempting to close one. This should never happen.`);
            return Promise.resolve();
        }

        // The promise may have already been resolved by resolveModal, in which case this is a no-op
        resolveModal(data);

        let removeModalPromise = removeModalPromisesStack.current[lastModalId];
        if (!removeModalPromise) {
            removeModalPromise = Promise.withResolvers<void>();
            removeModalPromisesStack.current[lastModalId] = removeModalPromise;
        }

        setModalStack((prevState) => ({
            ...prevState,
            modals: prevState.modals.map((modal) => (modal.id === lastModalId ? {...modal, isHiding: true} : modal)),
        }));

        return removeModalPromise.promise;
    };

    // Removes the modal from the stack. It is called by the modal itself once it has finished hiding.
    const removeModal: ModalContextType['removeModal'] = () => {
        setModalStack((prevState) => {
            const lastModalId = prevState.modals.at(-1)?.id;

            if (!lastModalId) {
                return prevState;
            }

            const removeModalPromise = removeModalPromisesStack.current?.[lastModalId];
            if (removeModalPromise) {
                removeModalPromise.resolve();
                delete removeModalPromisesStack.current[lastModalId];
            }

            return {
                ...prevState,
                modals: prevState.modals.slice(0, -1),
            };
        });
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
                    closeModal={closeModal}
                    resolveModal={resolveModal}
                    removeModal={removeModal}
                    isHiding={modalToRender.isHiding}
                />
            )}
        </ModalContext.Provider>
    );
}

export type {ModalProps};
export {ModalProvider, useModal, ModalActions};
