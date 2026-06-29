import type {TabRouterOptions} from '@react-navigation/native';

const defaultScreenOptions = {
    animation: 'default',
} as const;

/** `none` keeps the TabRouter from consuming the hardware back press, so it propagates up to dismiss the whole flow regardless of the active tab. */
const backBehavior: NonNullable<TabRouterOptions['backBehavior']> = 'none';

export {defaultScreenOptions, backBehavior};
