import base64
import logging
import sys

from algokit_utils.beta.account_manager import AddressAndSigner
from algokit_utils.beta.algorand_client import AlgorandClient, PayParams
from algosdk.atomic_transaction_composer import TransactionWithSigner
from algosdk.encoding import encode_address

from smart_contracts.artifacts.vote_chain.vote_chain_client import VoteChainClient


# Helper function: Sets up a logging.Logger for console and isolated file debugging
def setup_logger() -> logging.Logger:

    # Create a logger
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)  # Set level to DEBUG.

    # Create formatters
    # detailed_formatter = logging.Formatter(
    #     "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    # )
    console_formatter = logging.Formatter("%(levelname)s: %(message)s")

    # File handler (with timestamp in filename)
    # timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    # file_handler = logging.FileHandler(f"test_run_{timestamp}.log")
    # file_handler.setLevel(logging.DEBUG)
    # file_handler.setFormatter(detailed_formatter)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(console_formatter)

    # Add both handlers to the logger
    # logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger


# Helper function: Stores key transaction details in a dict with the corresponding transaction number in the blockchain
def store_txn_details(
    tx_id: str, sender: str, fee: int, txns_data: dict, logger: logging.Logger
) -> str:

    # Check length of transaction data dict and increment by 1 every entry
    txn_num = f"TXN-{len(txns_data) + 1}"
    txns_data[txn_num] = {
        "tx_id": tx_id,
        "sender": sender,
        "fee": fee,
    }

    # Log information every time a transaction is stored
    # logger.info(f"Transactions data: {txns_data}")

    # Return transaction number
    return txn_num


# Helper function: Extracts the transaction information from a specific block in the blockchain by referencing its num
def get_block_txn_info(
    algorand: AlgorandClient, transaction_response: any
) -> tuple[list, list]:

    # Wait until round is confirmed to get specific block number from the blockchain
    block_num = transaction_response.confirmed_round

    # Get all individual transaction IDs from the block (group ids don't count)
    block_txids = algorand.client.algod.get_block_txids(block_num)

    # Get block info from a specific block in the blockchain
    block_info = algorand.client.algod.block_info(block_num)

    # From block information extract the fee field out of every transaction
    block_fees = [txn["txn"].get("fee", 0) for txn in block_info["block"]["txns"]]

    # Return all block individual ids and fees as a Tuple with list types
    return block_txids["blockTxids"], block_fees


# Helper function: Sets up payment paramaters and returns a TransactionWithSigner object
def setup_stxn(
    algorand: AlgorandClient,
    sender: AddressAndSigner,
    receiver: str,
    amount: int,
    extra_fee: int = 0,
) -> TransactionWithSigner:

    # Define the payment parameters of the transaction
    payment_params = PayParams(
        sender=sender.address,
        receiver=receiver,
        amount=amount,
        extra_fee=extra_fee if extra_fee > 0 else 0,
    )

    # Using the Algorand client, prepare a payment transaction with the payment parameters defined above
    txn = algorand.transactions.payment(payment_params)

    # Wrap PaymentTxn in a TransactionWithSigner (NOTE: Transaction is not signed and sent yet, just prepared)
    stxn = TransactionWithSigner(txn=txn, signer=sender.signer)

    # Return the signed payment transaction
    return stxn


# Helper function: Get asset information from a specific account address and check this account's asset amount
def verify_asset_holding(
    algorand: AlgorandClient, address: str, test_asset_id: int, expected_amount: int
) -> bool:

    # Get the account's asset information from the Algorand client address
    asset_info = algorand.account.get_asset_information(address, test_asset_id)

    # If the account has not yet opted in to an asset (there is NO asset information/holding available)
    if asset_info is None or "asset-holding" not in asset_info:
        # If expected amount is 0, return True (this account is not holding any assets)
        if expected_amount == 0:
            return True
        else:
            # Else, expected amount is greater than 0, return False (this account asset is holding asset)
            return False

    # If thea account has already opted in to an asset (there is asset information/holding available)
    actual_amount = asset_info["asset-holding"]["amount"]

    # If the expected amount is equal to asset amount
    if actual_amount == expected_amount:
        return True  #  Expected amount=0 (asset info available, opted in)

    # Return False if asset info available but expected amount doesn't match the actual amount
    return False


# Helper function: Organize the transactions data using the 'sender' as key
def organize_txns_by_sender(
    txns_data: dict[str, dict[str, any]], logger: logging.Logger
) -> dict[str, dict[str, any]]:
    organized_data = {}

    # Iterate through original transactions
    for txn_num, txn_details in txns_data.items():
        sender = txn_details["sender"]

        # Initialize sender entry if it doesn't exist
        if sender not in organized_data:
            organized_data[sender] = {
                "transactions": [],
                "total_fees": 0,
                "total_transactions": 0,
            }

        # Create transaction record
        transaction = {
            "txn_num": txn_num,
            "tx_id": txn_details["tx_id"],
            "fee": txn_details["fee"],
        }

        # Update sender's data
        organized_data[sender]["transactions"].append(transaction)
        organized_data[sender]["total_fees"] += txn_details["fee"]
        organized_data[sender]["total_transactions"] += 1

    # Log the reorganized data
    logger.info("Transaction data reorganized by sender:")
    for sender, data in organized_data.items():
        logger.info(f"\nSender: {sender}")
        logger.info(f"Total transactions: {data['total_transactions']}")
        logger.info(f"Total fees: {data['total_fees']}")
        logger.info("Transactions:")
        for txn in data["transactions"]:
            logger.info(f"  {txn['txn_num']}: {txn['tx_id']} (fee: {txn['fee']})")

    return organized_data


def log_global_state_info(
    algorand: AlgorandClient,
    creator_address: str,
    app_id: int,
    logger: logging.Logger,
) -> None:
    acc_info = algorand.client.algod.account_application_info(creator_address, app_id)
    app_global_storage = acc_info["created-app"]["global-state"]

    logger.info(f"{creator_address} ACC INFO: {acc_info}")
    logger.info(f"{creator_address} GLOBAL STORAGE: {app_global_storage}")

    for entry in app_global_storage:
        key = base64.b64decode(entry["key"])
        value = entry["value"]

        if value["type"] == 1:
            byte_value = base64.b64decode(value["bytes"])
            if len(byte_value) == 32:
                decoded_address = encode_address(byte_value)
                logger.info(f"Entry Key: {key}, Decoded Address: {decoded_address}")
            else:
                logger.info(f"Entry Key: {key}, Decoded Bytes Literal: {byte_value}")
        elif value["type"] == 2:
            uint_value = value["uint"]
            logger.info(f"Entry Key: {key}, Decoded Uint: {uint_value}")


def log_local_state_info(
    app_client: VoteChainClient, address: str, logger: logging.Logger
) -> None:
    # Fetch local state for the account
    local_state = app_client.get_local_state(address)

    # Log the local vote status and choice for the account
    logger.info(f"{address} LOCAL VOTE STATUS: {local_state.local_vote_status}")
    logger.info(f"{address} LOCAL VOTE CHOICE: {local_state.local_vote_choice}")


def get_txn_logs(algorand: AlgorandClient, tx_id: str, logger: logging.Logger) -> None:

    txn_info = algorand.client.algod.pending_transaction_info(tx_id)
    txn_logs = txn_info["logs"]

    for log in txn_logs:
        base64_log = base64.b64decode(log)
        base64_log_bytes = base64_log.split(b": ")[1]

        if len(base64_log_bytes) == 32:
            logged_address = encode_address(base64_log_bytes)
            logger.info(f"Address in logs: {logged_address}")
        else:
            logged_int = int.from_bytes(base64_log_bytes)
            logger.info(f"Int in logs: {logged_int}")
