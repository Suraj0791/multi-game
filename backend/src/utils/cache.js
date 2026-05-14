import NodeCache from 'node-cache';

// Initialize cache 
// stdTTL: 30 = standard Time To Live is 30 seconds
// checkperiod: 10 = clean up expired keys every 10 seconds
const cache = new NodeCache({ stdTTL: 30, checkperiod: 10 });

export default cache;
