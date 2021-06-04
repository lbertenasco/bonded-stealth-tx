/*

- get all callers and jobs 

- hook into mempool and filter txs from callers to jobs

- when a tx is found public:

    - how to check if tx is valid:

        - block number is > current block number (ideally +1, but can be more if was using flashbots)
        - caller has enough bonds to cover for penalty
        - tx will not revert due to other non-stealth-vault related reasons (i.e. invalid keeper)
        - hash has not yet been reported (report tx will revert)

    - if tx seems valid:
        - report hash


*/
