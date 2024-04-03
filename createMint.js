import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  getMintLen,
  createInitializeMetadataPointerInstruction,
  getMint,
  getMetadataPointerState,
  getTokenMetadata,
  TYPE_SIZE,
  LENGTH_SIZE,
  getOrCreateAssociatedTokenAccount,
  mintToChecked,
  transferChecked,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  pack,
} from "@solana/spl-token-metadata";
import "dotenv/config";
import { getKeypairFromEnvironment } from "@solana-developers/helpers";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes/index.js";

// Payer wallet
const payer = getKeypairFromEnvironment("ADMIN_ACCOUNT");

// Connection to devnet cluster
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// Transaction to send
let transaction;
// Transaction signature returned from sent transaction
let transactionSignature;

// Generate new keypair for Mint Account
const mintKeypair = Keypair.generate();
// const mintKeypair = getKeypairFromEnvironment("MINT_ACCOUNT");
console.log("mintKeypairs: ", mintKeypair.publicKey, mintKeypair.secretKey);

const mintSK = mintKeypair.secretKey.slice(0, 32);
const sk = bs58.encode(Buffer.from(mintKeypair.secretKey));
console.log("Mint Account Secret Key:", sk);

// Address for Mint Account
const mint = mintKeypair.publicKey;
// Decimals for Mint Account
const decimals = 9;
// Authority that can mint new tokens
const mintAuthority = payer.publicKey;
// Authority that can update token metadata
const updateAuthority = payer.publicKey;

// Metadata to store in Mint Account
const metaData = {
  updateAuthority: updateAuthority,
  mint: mint,
  name: "Bottle Test Tokens",
  symbol: "BTT",
  // uri: "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/DeveloperPortal/metadata.json",
  additionalMetadata: [["description", "Testnet random tokens"]],
};

// Size of MetadataExtension 2 bytes for type, 2 bytes for length
const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
// Size of metadata
const metadataLen = pack(metaData).length;

// Size of Mint Account with extension
const mintLen = getMintLen([ExtensionType.MetadataPointer]);

// Minimum lamports required for Mint Account
const lamports = await connection.getMinimumBalanceForRentExemption(
  mintLen + metadataExtension + metadataLen,
);

// Instruction to invoke System Program to create new account
const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey, // Account that will transfer lamports to created account
  newAccountPubkey: mint, // Address of the account to create
  space: mintLen, // Amount of bytes to allocate to the created account
  lamports, // Amount of lamports transferred to created account
  programId: TOKEN_2022_PROGRAM_ID, // Program assigned as owner of created account
});

// Instruction to initialize the MetadataPointer Extension
const initializeMetadataPointerInstruction =
  createInitializeMetadataPointerInstruction(
    mint, // Mint Account address
    updateAuthority, // Authority that can set the metadata address
    mint, // Account address that holds the metadata
    TOKEN_2022_PROGRAM_ID,
  );

// Instruction to initialize Mint Account data
const initializeMintInstruction = createInitializeMintInstruction(
  mint, // Mint Account Address
  decimals, // Decimals of Mint
  mintAuthority, // Designated Mint Authority
  null, // Optional Freeze Authority
  TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
);

// Instruction to initialize Metadata Account data
const initializeMetadataInstruction = createInitializeInstruction({
  programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
  metadata: mint, // Account address that holds the metadata
  updateAuthority: updateAuthority, // Authority that can update the metadata
  mint: mint, // Mint Account address
  mintAuthority: mintAuthority, // Designated Mint Authority
  name: metaData.name,
  symbol: metaData.symbol,
  uri: metaData.uri,
});

// Instruction to update metadata, adding custom field
const updateFieldInstruction = createUpdateFieldInstruction({
  programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
  metadata: mint, // Account address that holds the metadata
  updateAuthority: updateAuthority, // Authority that can update the metadata
  field: metaData.additionalMetadata[0][0], // key
  value: metaData.additionalMetadata[0][1], // value
});

// Add instructions to new transaction
transaction = new Transaction().add(
  createAccountInstruction,
  initializeMetadataPointerInstruction,
  initializeMintInstruction,
  initializeMetadataInstruction,
  updateFieldInstruction,
);

// Send transaction
transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [payer, mintKeypair], // Signers
);

console.log(
  "\nCreate Mint Account:",
  `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
);

// Retrieve mint information
const mintInfo = await getMint(
  connection,
  mint,
  "confirmed",
  TOKEN_2022_PROGRAM_ID,
);

// Retrieve and log the metadata pointer state
const metadataPointer = getMetadataPointerState(mintInfo);
console.log("\nMetadata Pointer:", JSON.stringify(metadataPointer, null, 2));

// Retrieve and log the metadata state
const metadata = await getTokenMetadata(
  connection,
  mint, // Mint Account address
);
console.log("\nMetadata:", JSON.stringify(metadata, null, 2));

// Retrieve and log the metadata state
const updatedMetadata = await getTokenMetadata(
  connection,
  mint, // Mint Account address
);
console.log("\nUpdated Metadata:", JSON.stringify(updatedMetadata, null, 2));

console.log(
  "\nMint Account:",
  `https://solana.fm/address/${mint}?cluster=devnet-solana`,
);

// Create a ATA for tokenss to be minted
const ata = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mintKeypair.publicKey,
  mintKeypair.publicKey,
  false,
  "confirmed",
  {},
  TOKEN_2022_PROGRAM_ID,
);

console.log(`ata : ${ata.address.toString()} ATA of  ${ata.owner.toString()}`);

// MINT TOKENS
const mintTxnHash = await mintToChecked(
  connection,
  payer,
  mintKeypair.publicKey,
  ata.address,
  mintAuthority,
  100e9,
  decimals,
  undefined,
  { commitment: "confirmed", skipPreflight: true },
  TOKEN_2022_PROGRAM_ID,
);

console.log(`Mint tokens txn hash ${mintTxnHash}`);
