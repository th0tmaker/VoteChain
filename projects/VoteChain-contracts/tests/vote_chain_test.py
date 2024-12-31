# tests/vote_chain_test.py
import time

import pytest
from algokit_utils import TransactionParameters
from algokit_utils.beta.account_manager import AddressAndSigner
from algokit_utils.beta.algorand_client import AlgorandClient

from smart_contracts.artifacts.vote_chain.vote_chain_client import VoteChainClient

from .test_utils import get_txn_logs, log_local_state_info, setup_logger, setup_stxn

# Setup the logging.Logger
logger = setup_logger()


# Generate Algorand client that points to the default local net port and token
@pytest.fixture(scope="session")
def algorand() -> AlgorandClient:
    return AlgorandClient.default_local_net()


# Generate a dispenser account as AddreessAndSigner object that will fund other accounts
@pytest.fixture(scope="session")
def dispenser(algorand: AlgorandClient) -> AddressAndSigner:
    return algorand.account.dispenser()


# Generate a creator account for testing and fund it with some ALGO via the dispenser account
@pytest.fixture(scope="session")
def creator(algorand: AlgorandClient, dispenser: AddressAndSigner) -> AddressAndSigner:
    # Create a random Algorand account for the creator
    creator = algorand.account.random()
    # Setup signed transaction that funds the creator account (Dispenser is funding 10 ALGO to creator account address)
    fund_creator_acc = setup_stxn(algorand, dispenser, creator.address, 10_000_000)
    # Send the signed transaction using the Algorand client
    algorand.send.payment(fund_creator_acc)

    return creator


# Generate a random dummy account for testing and fund it with some ALGO via the dispenser account
@pytest.fixture(scope="session")
def dummy(algorand: AlgorandClient, dispenser: AddressAndSigner) -> AddressAndSigner:
    # Create a random Algorand account for the dummy
    dummy = algorand.account.random()
    # Setup signed transaction that funds the dummy account (Dispenser is funding 15 ALGO to dummy account address)
    fund_dummy_acc = setup_stxn(algorand, dispenser, dummy.address, 15_000_000)
    # Send the signed transaction using the Algorand client
    algorand.send.payment(fund_dummy_acc)

    return dummy


# Generate the first instance of the smart contract App client
@pytest.fixture(scope="session")
def app_client(algorand: AlgorandClient, creator: AddressAndSigner) -> VoteChainClient:
    # Creator evokes an instance of the smart contract client by sending a signed transaction to the algod network
    app_client = VoteChainClient(
        algod_client=algorand.client.algod,
        sender=creator.address,
        signer=creator.signer,
    )

    # Use App client to send a transaction that executes the 'create' abimethod within the smart contract
    generate_app_txn = app_client.create_generate()

    # Verify transaction was confirmed by the network
    assert (
        generate_app_txn.confirmed_round
    ), "Create generate App txn round successfully confirmed."

    # Log
    logger.info(f"DAPP ID: {app_client.app_id}")  # Check App ID
    logger.info(
        f"Global State attributes: {vars(app_client.get_global_state())}"
    )  # Check App Global State

    return app_client


# Generate a second instance of the smart contract App client (by passing first instance client app id as the reference)
@pytest.fixture(scope="session")
def app_client2(
    algorand: AlgorandClient, app_client: VoteChainClient, dummy: AddressAndSigner
) -> VoteChainClient:
    # Dummy evokes an instance of the smart contract client by sending a signed transaction to the algod network
    app_client2 = VoteChainClient(
        algod_client=algorand.client.algod,
        sender=dummy.address,
        signer=dummy.signer,
        app_id=app_client.app_id,  # Dummy references creator's App client by ID to evoke their own client of same App
    )

    return app_client2


# Test case for creator global storage allocation minimum balance requirement payment
def test_global_storage_mbr(
    algorand: AlgorandClient, app_client: VoteChainClient, creator: AddressAndSigner
) -> None:

    # Prepare transaction with signer for creator global schema MBR payment
    creator_global_mbr_pay_stxn = setup_stxn(
        algorand,
        creator,
        app_client.app_address,
        628_000,
        1000,  # 0.628 ALGO for every key-value + 0.001 extra fee
    )

    # Use App client to send a group transaction that executes the 'global_storage_mbr' abimethod and pays the MBR
    global_mbr_gtxn = app_client.global_storage_mbr(mbr_pay=creator_global_mbr_pay_stxn)

    # Verify transaction was confirmed by the network
    assert (
        global_mbr_gtxn.confirmed_round
    ), "Global MBR gtxn round successfully confirmed."


# Test case for user local storage opt in w/ minimum balance requirement payment
def test_opt_in_local_storage_mbr(
    algorand: AlgorandClient,
    app_client: VoteChainClient,
    app_client2: VoteChainClient,
    creator: AddressAndSigner,
    dummy: AddressAndSigner,
) -> None:

    # Prepare transaction with signer for creator local schema MBR payment
    creator_local_mbr_pay_app_stxn = setup_stxn(
        algorand,
        creator,
        app_client.app_address,
        257_000,
        1000,  # 0.257 ALGO for every key-value + 0.001 extra fee
    )

    # Use App client to send a group transaction that executes the 'local_storage_mbr' opt-in abimethod and pays the MBR
    creator_opt_in_local_mbr_gtxn = app_client.opt_in_local_storage_mbr(
        account=creator.address,
        mbr_pay=creator_local_mbr_pay_app_stxn,
        transaction_parameters=TransactionParameters(foreign_apps=[app_client.app_id]),
    )

    # Verify transaction was confirmed by the network
    assert (
        creator_opt_in_local_mbr_gtxn.confirmed_round
    ), "Creator Local Opt-In gtxn round successfully confirmed."

    # Do the same for the dummy account by using app_client2 (which references app_client by ID)
    dummy_local_mbr_pay_app_stxn = setup_stxn(
        algorand, dummy, app_client2.app_address, 257_000, 1000
    )

    dummy_opt_in_local_mbr_gtxn = app_client2.opt_in_local_storage_mbr(
        account=dummy.address,
        mbr_pay=dummy_local_mbr_pay_app_stxn,
        transaction_parameters=TransactionParameters(foreign_apps=[app_client2.app_id]),
    )

    assert (
        dummy_opt_in_local_mbr_gtxn.confirmed_round
    ), "Dummy Local Opt-In gtxn round successfully confirmed."

    # Log
    log_local_state_info(app_client, creator.address, logger)
    log_local_state_info(app_client, dummy.address, logger)


# Test case for user local storage opt out (via ["CloseOut"] abimethod) w/ minimum balance requirement payment refund
def test_opt_out_local_storage(
    algorand: AlgorandClient,
    app_client: VoteChainClient,
    app_client2: VoteChainClient,
    creator: AddressAndSigner,
    dummy: AddressAndSigner,
) -> None:

    # Get creator account balance before close out method is called
    creator_before_balance = algorand.account.get_information(creator.address)["amount"]
    logger.info(f"Creator account balance before close out: {creator_before_balance}")

    # Use App client to send a transaction that executes the 'out-out' close out abimethod for creator
    creator_close_out_txn = app_client.close_out_opt_out(account=creator.address)

    # Verify transaction was confirmed by the network
    assert (
        creator_close_out_txn.confirmed_round
    ), "Creator opt out gtxn round successfully confirmed."

    # Get creator account balance after close out method is called
    creator_after_balance = algorand.account.get_information(creator.address)["amount"]

    # Log
    logger.info(f"Creator account balance after close out: {creator_after_balance}")
    logger.info(f"Global State attributes: {vars(app_client.get_global_state())}")
    get_txn_logs(algorand, creator_close_out_txn.tx_id, logger)

    # Do the same test for dummy account
    dummy_before_balance = algorand.account.get_information(dummy.address)["amount"]
    logger.info(f"Dummy account balance before close out: {dummy_before_balance}")

    dummy_close_out_txn = app_client2.close_out_opt_out(account=dummy.address)

    assert (
        dummy_close_out_txn.confirmed_round
    ), "Dummy opt out gtxn round successfully confirmed."

    dummy_after_balance = algorand.account.get_information(dummy.address)["amount"]

    # Log
    logger.info(f"Dummy account balance after close out: {dummy_after_balance}")
    logger.info(f"Global State attributes: {vars(app_client.get_global_state())}")
    get_txn_logs(algorand, dummy_close_out_txn.tx_id, logger)


# Test case for set vote dates method
def test_setup_poll(algorand: AlgorandClient, app_client: VoteChainClient) -> None:
    date_format = "%m/%d/%Y"  # define the desired date format ~ motnh/day/year

    title = (
    b"01234567890123456789012345678901234567890123456789012345678"
    b"90123456789012345678901234567890123456789012345678901234567")  # 118 bytes in size

    choice1 = (
    b"0123456789012345678901234567890123456789012345678901234567"
    b"8901234567890123456789012345678901234567890123456789012345") # 116 bytes in size

    choice2 = b"Twice"
    choice3 = b""

    # Choose a start date that won't trip method assertions
    start_date_str = "12/22/2024"  #  write date as a string in specified format
    start_date_unix = int(
        time.mktime(time.strptime(start_date_str, date_format))
    )  # Obtain start date unix via time module by passing the start date string and the date format

    # Choose an end date that won't trip method assertions
    end_date_str = "01/05/2025"  #  write date as a string in specified format
    end_date_unix = int(
        time.mktime(time.strptime(end_date_str, date_format))
    )  # Obtain end date unix via time module by passing the start date string and the date format

    # Use App client to send a transaction that executes the 'set_vote_dates' abimethod
    setup_poll_txn = app_client.setup_poll(
        title=title,
        choice1=choice1,
        choice2=choice2,
        choice3=choice3,
        start_date_str=start_date_str,
        start_date_unix=start_date_unix,
        end_date_str=end_date_str,
        end_date_unix=end_date_unix,
    )

    # Verify transaction was confirmed by the network
    assert (
        setup_poll_txn.confirmed_round
    ), "Setup poll transaction round successfully confirmed."

    # Log
    logger.info("TEST SETUP POLL BELOW:")
    get_txn_logs(algorand, setup_poll_txn.tx_id, logger)



# Test case for submit vote method
# def test_submit_vote(
#     algorand: AlgorandClient,
#     app_client: VoteChainClient,
#     app_client2: VoteChainClient,
#     creator: AddressAndSigner,
#     dummy: AddressAndSigner,
# ) -> None:
#     creator_submit_vote_txn = app_client.submit_vote(account=creator.address, choice=1)
#     assert creator_submit_vote_txn.confirmed_round

#     # dummy_submit_vote_txn = app_client2.submit_vote(account=dummy.address, choice=2)
#     # assert dummy_submit_vote_txn.confirmed_round

#     # Log info
#     logger.info(f"Global State attributes: {vars(app_client.get_global_state())}")
#     log_local_state_info(app_client, creator.address, logger)
#     # log_local_state_info(app_client, dummy.address, logger)

#     get_txn_logs(algorand, creator_submit_vote_txn.tx_id, logger)


# Test case for deleting the smart contract App client
def test_delete_app(
    algorand: AlgorandClient, app_client: VoteChainClient, creator: AddressAndSigner
) -> None:

    # Get creator account balance before delete method is called
    creator_before_balance = algorand.account.get_information(creator.address)["amount"]
    logger.info(f"Creator account balance before deletion: {creator_before_balance}")

    # Use App client to send a transaction that executes the 'terminate' delete application abimethod
    creator_delete_app_txn = app_client.delete_terminate()

    # Verify transaction was confirmed by the network
    assert (
        creator_delete_app_txn.confirmed_round
    ), "Terminate App delete transaction round successfully confirmed."

    # Get creator account balance after delete method is called
    creator_after_balance = algorand.account.get_information(creator.address)["amount"]

    # Log
    logger.info(f"Creator account balance after deletion: {creator_after_balance}")
