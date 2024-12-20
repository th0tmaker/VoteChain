import time

import pytest
from algokit_utils import TransactionParameters
from algokit_utils.beta.account_manager import AddressAndSigner
from algokit_utils.beta.algorand_client import AlgorandClient

from smart_contracts.artifacts.vote_chain.vote_chain_client import VoteChainClient

from .test_utils import get_txn_logs, log_local_state_info, setup_logger, setup_stxn

# Setup the logging.Logger
logger = setup_logger()


# Create an Algorand client that points to the default local net port and token
@pytest.fixture(scope="session")
def algorand() -> AlgorandClient:
    return AlgorandClient.default_local_net()


# Create a dispenser account as AddreessAndSigner object that will fund other accounts
@pytest.fixture(scope="session")
def dispenser(algorand: AlgorandClient) -> AddressAndSigner:
    return algorand.account.dispenser()


# Create a random account for the DUMMY and fund it with some ALGO via the dispenser account
@pytest.fixture(scope="session")
def creator(algorand: AlgorandClient, dispenser: AddressAndSigner) -> AddressAndSigner:
    # Generate a random Algorand account for the creator
    creator = algorand.account.random()
    # Setup signed transaction that funds the creator account (Dispenser is funding 10 ALGO to creator account address)
    fund_creator_acc = setup_stxn(algorand, dispenser, creator.address, 10_000_000)
    # Send the signed transaction using the Algorand client
    algorand.send.payment(fund_creator_acc)

    return creator


# Create a random dummy account for testing and fund it with some ALGO via the dispenser account
@pytest.fixture(scope="session")
def dummy(algorand: AlgorandClient, dispenser: AddressAndSigner) -> AddressAndSigner:
    # Generate a random Algorand account for the dummy
    dummy = algorand.account.random()
    # Setup signed transaction that funds the dummy account (Dispenser is funding 15 ALGO to dummy account address)
    fund_dummy_acc = setup_stxn(algorand, dispenser, dummy.address, 15_000_000)
    # Send the signed transaction using the Algorand client
    algorand.send.payment(fund_dummy_acc)

    return dummy


# Create first instance of the smart contract App client
@pytest.fixture(scope="session")
def app_client(algorand: AlgorandClient, creator: AddressAndSigner) -> VoteChainClient:

    app_client = VoteChainClient(
        algod_client=algorand.client.algod,
        sender=creator.address,
        signer=creator.signer,
    )

    app_client.create_create_app()

    logger.info(f"DAPP ID: {app_client.app_id}")
    logger.info(f"Global State attributes: {vars(app_client.get_global_state())}")

    return app_client


# Create second instance of the smart contract App client (by passing first instance client app id)
@pytest.fixture(scope="session")
def app_client2(
    algorand: AlgorandClient, app_client: VoteChainClient, dummy: AddressAndSigner
) -> VoteChainClient:

    app_client2 = VoteChainClient(
        algod_client=algorand.client.algod,
        sender=dummy.address,
        signer=dummy.signer,
        app_id=app_client.app_id,
    )

    return app_client2


# Test case for local storage OptIn method
def test_opt_in_local_storage(
    algorand: AlgorandClient,
    app_client: VoteChainClient,
    app_client2: VoteChainClient,
    creator: AddressAndSigner,
    dummy: AddressAndSigner,
) -> None:

    # Prepare transaction with signer for creator MBR payment
    creator_mbr_pay_app_stxn = setup_stxn(
        algorand, creator, app_client.app_address, 257_000, 1000
    )

    # Execute opt in local storage group transaction for creator Opt-In transaction
    creator_opt_in_gtxn = app_client.opt_in_local_storage(
        account=creator.address,
        mbr_pay=creator_mbr_pay_app_stxn,
        transaction_parameters=TransactionParameters(foreign_apps=[app_client.app_id]),
    )

    # Verify craetor opt in local storage group transaction confirmed
    assert (
        creator_opt_in_gtxn.confirmed_round
    ), "Random Opt-In round successfully confirmed."

    logger.info(f"Global State attributes: {vars(app_client.get_global_state())}")

    # Prepare transaction with signer for dummy MBR payment
    dummy_mbr_pay_app_stxn = setup_stxn(
        algorand, dummy, app_client2.app_address, 257_000, 1000
    )

    # Execute opt in local storage group transaction for dummy Opt-In transaction
    dummy_opt_in_gtxn = app_client2.opt_in_local_storage(
        account=dummy.address,
        mbr_pay=dummy_mbr_pay_app_stxn,
        transaction_parameters=TransactionParameters(foreign_apps=[app_client2.app_id]),
    )

    # Verify dummy opt in local storage group transaction confirmed
    assert (
        dummy_opt_in_gtxn.confirmed_round
    ), "Random Opt-In round successfully confirmed."

    # Log info
    log_local_state_info(app_client, creator.address, logger)
    # log_local_state_info(app_client, dummy.address, logger)

    logger.info(f"Global State attributes: {vars(app_client.get_global_state())}")


# Test case for CloseOut method
def test_close_out(
    algorand: AlgorandClient,
    app_client: VoteChainClient,
    app_client2: VoteChainClient,
    dummy: AddressAndSigner,
) -> None:

    dummy_before_balance = algorand.account.get_information(dummy.address)["amount"]
    logger.info(f"Dummy account balance before close out: {dummy_before_balance}")

    dummy_close_out_txn = app_client2.close_out_opt_out(account=dummy.address)
    assert dummy_close_out_txn.confirmed_round

    logger.info(f"Global State attributes: {vars(app_client.get_global_state())}")

    # Log info
    get_txn_logs(algorand, dummy_close_out_txn.tx_id, logger)

    dummy_after_balance = algorand.account.get_information(dummy.address)["amount"]
    logger.info(f"Dummy account balance after close out: {dummy_after_balance}")


# Test case for set vote dates method
def test_set_vote_dates(app_client: VoteChainClient) -> None:
    date_format = "%m/%d/%Y"

    vote_start_date_str = "11/30/2024"
    vote_start_date_unix = int(
        time.mktime(time.strptime(vote_start_date_str, date_format))
    )

    vote_end_date_str = "12/13/2024"
    vote_end_date_unix = int(time.mktime(time.strptime(vote_end_date_str, date_format)))

    set_vote_date_txn = app_client.set_vote_dates(
        vote_start_date_str=vote_start_date_str,
        vote_start_date_unix=vote_start_date_unix,
        vote_end_date_str=vote_end_date_str,
        vote_end_date_unix=vote_end_date_unix,
    )

    assert set_vote_date_txn.confirmed_round


# Test case for submit vote method
def test_submit_vote(
    algorand: AlgorandClient,
    app_client: VoteChainClient,
    app_client2: VoteChainClient,
    creator: AddressAndSigner,
    dummy: AddressAndSigner,
) -> None:
    creator_submit_vote_txn = app_client.submit_vote(account=creator.address, choice=1)
    assert creator_submit_vote_txn.confirmed_round

    # dummy_submit_vote_txn = app_client2.submit_vote(account=dummy.address, choice=2)
    # assert dummy_submit_vote_txn.confirmed_round

    # Log info
    logger.info(f"Global State attributes: {vars(app_client.get_global_state())}")
    log_local_state_info(app_client, creator.address, logger)
    # log_local_state_info(app_client, dummy.address, logger)

    get_txn_logs(algorand, creator_submit_vote_txn.tx_id, logger)

    # test case for updating vote dates (after they were already previous set) method
    # def test_set_vote_dates_update(app_client: VoteChainClient) -> None:
    #     date_format = "%m/%d/%Y"

    #     vote_start_date_str = "11/30/2024"
    #     vote_start_date_unix = int(
    #         time.mktime(time.strptime(vote_start_date_str, date_format))
    #     )

    #     vote_end_date_str = "12/14/2024"
    #     vote_end_date_unix = int(time.mktime(time.strptime(vote_end_date_str, date_format)))

    #     set_vote_date_txn = app_client.set_vote_dates(
    #         vote_start_date_str=vote_start_date_str,
    #         vote_start_date_unix=vote_start_date_unix,
    #         vote_end_date_str=vote_end_date_str,
    #         vote_end_date_unix=vote_end_date_unix,
    #     )

    #     assert set_vote_date_txn.confirmed_round
