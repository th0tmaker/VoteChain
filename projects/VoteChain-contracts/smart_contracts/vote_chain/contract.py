# smart_contracts/vote_chain/contract.py
from algopy import (
    Account,
    Application,
    ARC4Contract,
    Bytes,
    Global,
    LocalState,
    String,
    Txn,
    UInt64,
    arc4,
    gtxn,
    itxn,
    log,
    subroutine,
)


class VoteChain(ARC4Contract):
    # Global State type declarations
    poll_title: Bytes
    poll_choice1: Bytes
    poll_choice2: Bytes
    poll_choice3: Bytes

    poll_start_date_unix: UInt64
    poll_end_date_unix: UInt64
    poll_finalized: UInt64

    total_accounts_opted_in: UInt64

    choice1_total: UInt64
    choice2_total: UInt64
    choice3_total: UInt64
    total_votes: UInt64

    def __init__(self) -> None:
        super().__init__()
        # Local State type declarations
        self.local_vote_status = LocalState(
            UInt64,
            key="vote_status",
            description="Account vote status ('0' = not voted, '1' = voted)",
        )

        self.local_vote_choice = LocalState(
            UInt64,
            key="vote_choice",
            description="Account vote choice (based on UInt64 corresponding w/ choice)",
        )

    # Define subroutine that calculates the minimum balance requirement total cost
    @subroutine
    def calc_mbr(self, num_bytes: UInt64, num_uint: UInt64) -> UInt64:
        base_fee = UInt64(100_000)  # Base fee
        byte_fee = UInt64(50_000)  # Byte slice fee for key-value pair
        uint_fee = UInt64(28_500)  # UInt64 fee for key-value pair

        # Multiply respective fee cost with the number of key-value pairs in each schema to get total fee amount
        total_byte_fee = byte_fee * num_bytes
        total_uint_fee = uint_fee * num_uint

        # Return the minimum balance requirement total cost
        return Global.min_balance + base_fee + total_byte_fee + total_uint_fee

    # Define abimethod that creates the smart contract App
    @arc4.abimethod(create="require")
    def generate(self) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender == Global.creator_address
        ), "Transaction sender must match creator address."

        # Global storage variable assignments
        self.total_accounts_opted_in = UInt64(0)

        self.poll_finalized = UInt64(0)

        self.choice1_total = UInt64(0)
        self.choice2_total = UInt64(0)
        self.choice3_total = UInt64(0)
        self.total_votes = UInt64(0)

        # Log info on-chain
        arc4.emit("View(uint64)", Global.current_application_id.id)
        log(
            "Generation method successful for App ID: ",
            Global.current_application_id.id,
        )

    # Define abimethod that allows the creator to use global storage by paying a MBR cost
    @arc4.abimethod()
    def global_storage_mbr(self, mbr_pay: gtxn.PaymentTransaction) -> None:
        # Make necessary assertions to verify transaction requirements
        assert mbr_pay.amount == self.calc_mbr(
            num_bytes=UInt64(4), num_uint=UInt64(8)  # Calc MBR for using global schema
        ), "MBR payment must meet the minimum requirement amount."
        assert (
            mbr_pay.sender == Global.creator_address
        ), "MBR payment sender must match the App creator account."
        assert (
            mbr_pay.receiver == Global.current_application_address
        ), "MBR payment reciever must be the App address."

        # Log info on-chain
        log("Global State successfully funded by account address: ", Txn.sender)

    # Define abimethod that allows any user to opt in to the smart contract's local storage by paying a MBR cost
    @arc4.abimethod(allow_actions=["OptIn"])
    def local_storage_mbr(
        self, account: Account, mbr_pay: gtxn.PaymentTransaction
    ) -> None:
        # Make necessary assertions to verify transaction requirements
        assert mbr_pay.amount == self.calc_mbr(
            num_bytes=UInt64(0), num_uint=UInt64(2)  # Calc MBR for using local schema
        ), "MBR payment must meet the minimum requirement amount."
        assert (
            mbr_pay.sender == account
        ), "MBR payment sender must match the account opting in."
        assert (
            mbr_pay.receiver == Global.current_application_address
        ), "MBR payment reciever must be the App address."

        # Change local state var 'self.local_vote_status' (specific to account) value from 'None' to '0'
        self.local_vote_status[account] = UInt64(0)

        # Change local state var 'self.local_vote_choice' (specific to account) value from 'None' to '0'
        self.local_vote_choice[account] = UInt64(0)

        # Increment count for total accounts opted in
        self.total_accounts_opted_in += UInt64(1)

        # Log info on-chain
        log("Local State successfully funded by account address: ", Txn.sender)

    # Define abimethod that allows any user to opt out of the smart contract's local storage via the 'close out' method
    @arc4.abimethod(allow_actions=["CloseOut"])
    def opt_out(self, account: Account) -> None:
        # Make necessary assertions to verify transaction requirements
        assert account.is_opted_in(
            Application(Global.current_application_id.id)
        ), "Account must first be opted-in to App client in order to close out."

        assert (  # Account is opted-in and hasn't voted yet
            account.is_opted_in(Application(Global.current_application_id.id))
            and self.local_vote_choice[account] == UInt64(0)
        ) or (  # Account is opted-in and has voted and voting period is over
            account.is_opted_in(Application(Global.current_application_id.id))
            and self.local_vote_choice[account] != UInt64(0)
            and Global.latest_timestamp > self.poll_end_date_unix
        ), "Requirements for opting-out of App client are insufficient."

        # Delete the user's local storage
        del self.local_vote_status[account]
        del self.local_vote_choice[account]

        # Decrease the total count of opted-in accounts
        self.total_accounts_opted_in -= UInt64(1)

        # Submit inner transaction (account gets their mbr payment refunded)
        min_txn_fee = UInt64(1000)
        itxn.Payment(
            receiver=account,
            amount=self.calc_mbr(num_bytes=UInt64(0), num_uint=UInt64(2)) - min_txn_fee,
            sender=Global.current_application_address,
            fee=min_txn_fee,
            note="MBR refund for closing out.",
        ).submit()

        # Log info on-chain
        log("Close-out method successful for account address: ", account)

    # Define abimethod that allows the creator to set up the poll values
    @arc4.abimethod()
    def setup_poll(
        self,
        title: Bytes,
        choice1: Bytes,
        choice2: Bytes,
        choice3: Bytes,
        start_date_str: String,
        start_date_unix: UInt64,
        end_date_str: String,
        end_date_unix: UInt64,
    ) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender == Global.creator_address
        ), "Only App creator can set vote dates."

        assert (title.length <= UInt64(118)), "Poll title size can not exceed 118 bytes of data per key-value."

        assert (
            choice1.length <= UInt64(116) and
            choice2.length <= UInt64(116) and
            choice3.length <= UInt64(116)
        ), "Poll choice size cannot exceed 116 bytes of data per key-value."

        # UNCOMMENT WHEN DONE TESTING!
        # assert (
        #     vote_start_date_unix >= Global.latest_timestamp
        # ), "Start date must be not be earlier than current date."

        # assert (
        #     vote_end_date_unix >= Global.latest_timestamp
        # ), "End date must not be earlier than the current timestamp."

        assert (
            start_date_unix < end_date_unix
        ), "Start date must be earlier than end date."

        assert end_date_unix >= start_date_unix + UInt64(
            3 * 24 * 60 * 60
        ), "End date must be at least 3 days later than the start date."

        assert end_date_unix - start_date_unix <= UInt64(
            14 * 24 * 60 * 60
        ), "Voting period can not exceed 14 days."

        assert self.poll_finalized == UInt64(0), "Poll can only be setup once."

        # Update global schema values
        self.poll_title = title
        self.poll_choice1 = choice1
        self.poll_choice2 = choice2
        self.poll_choice3 = choice3
        self.poll_start_date_unix = start_date_unix
        self.poll_end_date_unix = end_date_unix

        self.poll_finalized = UInt64(1)  # finalize poll

        # Log info on-chain
        log("Poll start date: ", start_date_str)
        log("Poll end date: ", end_date_str)

    # Define abimethod that allows any user to submit their vote
    @arc4.abimethod
    def submit_vote(self, account: Account, choice: UInt64) -> None:
        # Make necessary assertions to verify transaction requirements
        assert account.is_opted_in(
            Application(Global.current_application_id.id)
        ), "Account must be opted-in before voting."

        assert (
            Global.latest_timestamp > self.poll_start_date_unix
        ), "Voting period has not started yet."

        assert (
            Global.latest_timestamp < self.poll_end_date_unix
        ), "Voting period has ended."

        assert self.local_vote_choice[account] == UInt64(
            0
        ), "This account already submitted a vote."

        assert (
            choice == UInt64(1) or choice == UInt64(2) or choice == UInt64(3)
        ), "Invalid choice. Can only choose between choices 1, 2, 3."

        # Mark the account as having voted
        self.local_vote_status[account] = UInt64(1)

        # Increment count for total votes
        self.total_votes += UInt64(1)

        # Update vote tally
        if choice == UInt64(1):
            self.choice1_total += UInt64(1)
            self.local_vote_choice[account] = UInt64(1)
        elif choice == UInt64(2):
            self.choice2_total += UInt64(1)
            self.local_vote_choice[account] = UInt64(2)
        else:
            self.choice3_total += UInt64(1)
            self.local_vote_choice[account] = UInt64(3)

        # Log info on-chain
        log("Vote submitted successfully for account address: ", account)
        log("Vote submitted for choice number: ", choice)

    # Define abimethod that allows the creator to delete App and get their global schema MBR cost refunded
    @arc4.abimethod(allow_actions=["DeleteApplication"])
    def terminate(self) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender == Global.creator_address
        ), "Only App creator can terminate the App."

        # Submit inner transaction (creator gets their mbr payment refunded)
        min_txn_fee = UInt64(1000)
        itxn.Payment(
            receiver=Global.creator_address,
            amount=self.calc_mbr(num_bytes=UInt64(0), num_uint=UInt64(8)) - min_txn_fee,
            sender=Global.current_application_address,
            fee=min_txn_fee,
            note="MBR refund for deleting App.",
        ).submit()

        # Log info on-chain
        log(
            "Termination method successful for App ID: ",
            Global.current_application_id.id,
        )
