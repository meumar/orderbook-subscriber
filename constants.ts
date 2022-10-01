export const markets = ["perp", "spot"];         //market names
export const action = ['buy', 'sell'];           //actions
export const actionKeys = {
    buy: 'asksKey',
    sell: 'bidsKey'
};
export const actionRequired = {
    buy: 'sell',
    sell: 'buy'
};
export const marketNames = {
    perp: 'perpMarkets',
    spot: 'spotMarkets'
};

export const clusters = ['mainnet', 'devnet', 'testnet'];