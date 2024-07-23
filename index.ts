import {
    BookSide,
    BookSideLayout,
    Config,
    GroupConfig,
    MangoClient,
    IDS
} from '@blockworks-foundation/mango-client';
import { Commitment, Connection } from '@solana/web3.js';
import { markets, action, actionKeys, marketNames, actionRequired, clusters } from './constants';   //import constants
const readlineSync = require('readline-sync');

let quoteCurrency: any = [], orderIds: any = [], selectedCluster: any = "";

const subscribeToOrderbook = async () => {
    try{
        messageHelper("Running...");
        // setup client
        let selectedClusterIndex = readlineSync.keyInSelect(clusters, "Select cluster to connect?");
        selectedCluster = clusters[selectedClusterIndex];
        const config = new Config(IDS);
        const groupConfig = getGroupConfigByCluster(config, selectedCluster);
        messageHelper("Cluster: "+ groupConfig.cluster);
    
    
    
        //setup market perp or spot
        const selectedMarket = readlineSync.keyInSelect(markets, 'Select market?');
        if (selectedMarket < 0) {
            messageHelper("Cancelled");
            return
        }
        messageHelper("Selected market: "+ markets[selectedMarket]);
    
    
        //set up quote coin
        quoteCurrency = [...groupConfig[marketNames[markets[selectedMarket]]].flatMap(e => e.baseSymbol)];

        const qouteIndex = readlineSync.keyInSelect(quoteCurrency, "Select Quote currency");
        if (qouteIndex < 0) {
            messageHelper("Cancelled");
            return
        }
        messageHelper("Selected Quote currency "+ quoteCurrency[qouteIndex]);
    
    
    
        //connect to cluster
        const connection = new Connection(
            config.cluster_urls[groupConfig.cluster],
            'processed' as Commitment,
        );
        const client = new MangoClient(connection, groupConfig.mangoProgramId);
    
    
    
        // load group & market
        let perpMarketConfig = getMarketByBaseSymbolAndKind(
            groupConfig[marketNames[markets[selectedMarket]]],
            quoteCurrency[qouteIndex]
        );
        perpMarketConfig = { ...perpMarketConfig, ...{ kind: markets[selectedMarket] } }
        const mangoGroup = await client.getMangoGroup(groupConfig.publicKey);
        const perpMarket = await mangoGroup.loadPerpMarket(
            connection,
            perpMarketConfig.marketIndex,
            perpMarketConfig.baseDecimals,
            perpMarketConfig.quoteDecimals,
        );
    
    
        //setup action & at what quantity
        const actionIndex = readlineSync.keyInSelect(action, 'Select?');
        if (actionIndex < 0) {
            messageHelper("Cancelled");
            return
        }
        const ratio = readlineSync.questionFloat(`${action[actionIndex] == 'sell' ? 'Min' : 'Max'} value you are willing for One ${quoteCurrency[qouteIndex]} in USDC? Enter number: `);
        if (typeof ratio !== 'number') {
            messageHelper("Invalid input");
            return
        };
    
    
        //load best and first 100 orders from the market
        messageHelper(`To ${action[actionIndex]} ${quoteCurrency[qouteIndex]} at ${ratio} ratio finding best order...`);
        if (action[actionIndex] == 'sell') {
            const bids = await perpMarket.loadBids(connection);
            messageHelper(`Best price: ${bids.getBest()?.price} of quantity: ${bids.getBest()?.size}. Order id is ${bids.getBest()?.orderId.toString('hex')}`);
            messageHelper("Searching on last 100 orders");
            for (const [price, size, orderId] of bids.getL2(100)) {
                if (orderIds.indexOf(orderId.toString('hex')) === -1 && price >= ratio) {
                    messageHelper(`Price: ${price}, of quantity ${size}. Order is: ${orderId.toString('hex')}`);
                }
            }
        } else {
            const asks = await perpMarket.loadAsks(connection);
            messageHelper(`Best price: ${asks.getBest()?.price} of quantity: ${asks.getBest()?.size}. Order id is ${asks.getBest()?.orderId.toString('hex')}`);
            messageHelper("Searching on last 100 orders");
            for (const [price, size, orderId] of asks.getL2(100)) {
                if (orderIds.indexOf(orderId.toString('hex')) === -1 && price <= ratio) {
                    messageHelper(`Price: ${price}, of quantity ${size}. Order is: ${orderId.toString('hex')}`);
                }
            }
        }
        messageHelper(`Searching of the orders ${action[actionIndex] == 'sell' ? 'above' : 'below'} or equal to ${ratio}`);

        //subscribe order book
        connection.onAccountChange(perpMarketConfig[actionKeys[action[actionIndex]]], (accountInfo) => {
            const orderBook = new BookSide(
                perpMarketConfig[actionKeys[action[actionIndex]]],
                perpMarket,
                BookSideLayout.decode(accountInfo.data),
            );
            for (const order of orderBook) {
                if (actionRequired[action[actionIndex]] == order.side && ((order.price >= ratio && action[actionIndex] == 'sell') || (order.price <= ratio && action[actionIndex] == 'buy'))) {
                    if (orderIds.indexOf(order.orderId.toString('hex')) === -1) {
                        orderIds.push(order.orderId.toString('hex'));
                        messageHelper(`Price: ${order.price}, of quantity ${order.size}. Order is: ${order.orderId.toString('hex')}`)
                    }
                }
            }
        });
    }catch(e){
        messageHelper("Error Something went wrong!")
        console.log(e);
    }
}

//helper functions
const getGroupConfigByCluster = (config, cluster) => {
    return config.groups.find(e => e.cluster == cluster) || {};
};

const getMarketByBaseSymbolAndKind = (marketConfig, quoteCurrency) => {
    return marketConfig.find(e => e.baseSymbol === quoteCurrency);
};

const messageHelper = (message) => {
    console.log(message);
};

//calling main fuction
subscribeToOrderbook();