import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';

const VAULT_ACTION_FLOW_ROUTES = new Set([
  'BorrowFlow',
  'DepositFlow',
  'RepayFlow',
  'WithdrawFlow',
]);

type NavigationStateLike = {
  index?: number;
  routes?: Array<{ name?: string }>;
};

type VaultNavigationLike = NavigationProp<ParamListBase> & {
  getState?: () => NavigationStateLike;
  getParent?: () => VaultNavigationLike | undefined;
};

function getActiveRouteName(state: NavigationStateLike | undefined): string | undefined {
  const routes = state?.routes;
  if (!routes || routes.length === 0) {
    return undefined;
  }

  const index = typeof state.index === 'number' ? state.index : routes.length - 1;
  return routes[index]?.name;
}

function findVaultActionFlowNavigator(navigation: VaultNavigationLike): VaultNavigationLike | null {
  let parent = navigation.getParent?.();

  while (parent) {
    const activeRouteName = getActiveRouteName(parent.getState?.());
    if (activeRouteName && VAULT_ACTION_FLOW_ROUTES.has(activeRouteName)) {
      return parent;
    }
    parent = parent.getParent?.();
  }

  return null;
}

export function dismissVaultActionFlow(navigation: NavigationProp<ParamListBase>): void {
  const nav = navigation as VaultNavigationLike;
  const flowNavigator = findVaultActionFlowNavigator(nav);

  if (flowNavigator) {
    flowNavigator.dispatch(StackActions.pop(1));
    return;
  }

  const parent = nav.getParent?.();
  if (parent?.canGoBack?.()) {
    parent.goBack();
    return;
  }

  if (nav.canGoBack?.()) {
    nav.goBack();
  }
}
