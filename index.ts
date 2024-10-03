import { transcode } from 'buffer';
import * as crypto from 'crypto';

// Transaction class
class Transaction {
    public payer: string;
    public payee: string;
    public amount: number;

    constructor(payer: string, payee: string, amount: number ,) {
        this.payer = payer;
        this.payee = payee;
        this.amount = amount;

    }

    toString(){
        return JSON.stringify(this);
    }

}

//--------------------------------------------------------------------------------//

// Block class 
class Block{

    public prevHash : string;
    public transaction : Transaction;
    public nonce = Math.round(Math.random()*999999999);
    public timeStamp : string;


    constructor(prevHash: string, transaction: Transaction)
    {
        this.transaction = transaction;
        this.prevHash = prevHash;
        this.timeStamp = new Date().toLocaleString();
    }


    get hash(){
        const str = JSON.stringify(this);
        const hash = crypto.createHash('SHA256');
        hash.update(str).end();
        return hash.digest('hex');
    }

}

//--------------------------------------------------------------------------------//

//Chain class
class Chain{

    // A single instance of chain 
    public static instance = new Chain();

    // The chain it self is an array of Blocks 
    chain : Block[];
    // A set that keeps track of all wallets in the system
    wallets: Map<string, Wallet>; // Store wallets by public key

    // Creating the chain with the first block "the genesis block"
    constructor()
    {
        this.chain = [new Block('',new Transaction('genesis','saleem',1000))];
        this.wallets = new Map();
    }

    // Method to add a wallet
    addWallet(wallet: Wallet) {
        this.wallets.set(wallet.publicKey, wallet); // Add wallet to the map
    }

    // Method to get a wallet by its public key
    getWalletByPublicKey(publicKey: string): Wallet | undefined {
        return this.wallets.get(publicKey); // Return the wallet or undefined
    }


    // Returns the last block in the blockchain.
    get lastBlock(){
        return this.chain[this.chain.length-1];
    }

    // A method for finding the soloution of which hashing it along side
    // the block's nonce gives as a hash with a prefix of 4 zeros (aka mining)
    mine(nonce: number){
        let solution = 1;
        console.log("Mining transaction...");

        while(true){
            const hash = crypto.createHash('SHA256');
            hash.update((nonce+solution).toString()).end();

            const attempt = hash.digest('hex');
            if(attempt.substring(0,4) == '0000'){
                console.log(`---> Solved transaction with solution: ${solution}. Block is confirmed!\n`);
                return solution;
            }

            solution++;
        }
    }


    addBlock(transaction:Transaction , payerPublicKey: string , signature: Buffer){

        console.log("Sending Money...");

        // Verifying the transaction's signature.
        const verifier = crypto.createVerify('SHA256');
        verifier.update(transaction.toString());
        const isValid = verifier.verify(payerPublicKey,signature);

        // if the transaction block has valid signature we added it to the blockchain.
        if(isValid){
            console.log("Transaction is valid.");
            const newBlock = new Block(this.lastBlock.hash,transaction);
            this.mine(newBlock.nonce);
            this.chain.push(newBlock);

            // Find the payee wallet and call receiveMoney
            const payeeWallet = this.getWalletByPublicKey(transaction.payee);
            if (payeeWallet) {
                payeeWallet.receiveMoney(transaction); // Call receiveMoney to update the balance
            }

        } else {
            throw new Error("Invalid transaction signature.");
        }
    }


}


//--------------------------------------------------------------------------------//

//Wallet class 
class Wallet{

    public privateKey : string;
    public publicKey: string;
    public transactionHistory: Transaction[];
    public balance : number;

    constructor() {
        const {publicKey , privateKey} = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });

        this.privateKey = privateKey;
        this.publicKey = publicKey;
        this.transactionHistory = [];
        this.balance = 500;

        // Add this wallet to the chain's wallet set
        Chain.instance.addWallet(this); // Register the wallet with the chain
    }

    sendMoney(amount: number , payeePublicKey: string){

        // Check if the payee wallet exists
        const payeeWallet = Chain.instance.getWalletByPublicKey(payeePublicKey);
    
        if (!payeeWallet) {
            console.log(`Error: Payee wallet with public key ${payeePublicKey} does not exist.`);
            return; // Abort the transaction if the payee does not exist
        }

        // Ensure that the sender has sufficient balance
        if (this.balance < amount) {
            console.log(`Error: Insufficient balance to send ${amount}. Current balance: ${this.balance}.`);
            return;
        }

        // Creating the new transaction.
        const newTransaction = new Transaction(this.publicKey,payeePublicKey,amount);

        // Signing the transaction with a digital signature.
        const sign = crypto.createSign('SHA256');
        sign.update(newTransaction.toString()).end();
        const signature = sign.sign(this.privateKey);

        // Add the transaction to the sender's history
        this.transactionHistory.push(newTransaction);

        // Deduct the amount from the sender's balance
        this.balance -= amount;

        // Adding the new transaction block into the blockchain instance
        // along with the signature and the senders public key to verify it.
        Chain.instance.addBlock(newTransaction,this.publicKey,signature)
    }

     // New method to receive money
    receiveMoney(transaction: Transaction) {
        this.transactionHistory.push(transaction);
        this.balance += transaction.amount; // Update balance when receiving money
        console.log(`Received ${transaction.amount} from ${transaction.payer} to ${this.publicKey}`);
    }

    // Method to show the current balance
    showBalance() {
        console.log(`Balance for wallet ${this.publicKey}: ${this.balance}`);
    }

    // Shows the transaction history for this wallet.
    logTransaction(){
        console.log(`Transactions history for ${this.publicKey}:`);
        this.transactionHistory.forEach((transaction,index)=>{
            console.log(`${index+1}: ${transaction.toString()}`);
        })
    }
    
    
}


//--------------------------------------------------------------------------------//

// Using the code
const saleem = new Wallet();
const frodo = new Wallet();
const gandalf = new Wallet();

// Add wallets to the chain
Chain.instance.addWallet(saleem);
Chain.instance.addWallet(frodo);
Chain.instance.addWallet(gandalf);

// Initially show balances
saleem.showBalance(); // Balance: 500
frodo.showBalance(); // Balance: 500
gandalf.showBalance(); // Balance: 500

// Perform transactions
saleem.sendMoney(50, frodo.publicKey);
frodo.sendMoney(23, gandalf.publicKey);
gandalf.sendMoney(5, frodo.publicKey);

// Show balances after transactions
saleem.showBalance(); // Updated balance
frodo.showBalance(); // Updated balance
gandalf.showBalance(); // Updated balance

console.log(Chain.instance);