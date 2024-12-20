from algopy import (
    Account,
    Application,
    ARC4Contract,
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
    total_accounts_opted_in: UInt64

    choice1_vote_count: UInt64
    choice2_vote_count: UInt64
    choice3_vote_count: UInt64

    total_vote_count: UInt64

    vote_start_date_unix: UInt64
    vote_end_date_unix: UInt64
    vote_dates_final: UInt64

    def __init__(self) -> None:
        super().__init__()
        # Global storage variable assignments
        self.total_accounts_opted_in = UInt64(0)

        self.choice1_vote_count = UInt64(0)
        self.choice2_vote_count = UInt64(0)
        self.choice3_vote_count = UInt64(0)

        self.total_vote_count = UInt64(0)

        self.vote_dates_final = UInt64(0)

        # Local storage variable assignmnents
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

    # Define subroutine that calculates the minimum balance requirement for opting in to the App
    @subroutine
    def calc_mbr(self) -> UInt64:
        local_base_opt_in_fee = UInt64(100_000)  # Base opt-in fee.
        local_byte_fee = UInt64(50_000)  # Base byte slice fee for key-value pair.
        local_uint_fee = UInt64(28_500)  # Base integer fee for key-value pair.

        # Define the number of local variables for UInt64 and Bytes
        local_num_uint = UInt64(2)  # Currently: '2' - UInt64 variables.
        local_num_bytes = UInt64(0)  # Currently: '0' - Byte slices variable.

        # Calculate the total fees for integers and byte slices
        total_local_int_fee = local_uint_fee * local_num_uint
        total_local_byte_fee = local_byte_fee * local_num_bytes

        # Return the total minimum balance requirement total
        return (
            Global.min_balance
            + local_base_opt_in_fee
            + total_local_int_fee
            + total_local_byte_fee
        )

    # Define abimethod that creates the smart contract App
    @arc4.abimethod(allow_actions=["NoOp"], create="require")
    def create_app(self) -> None:
        self.app_id = Global.current_application_id  # Store App ID.
        self.app_address = Global.current_application_address  # Store App address.
        self.app_init_timestamp = Global.latest_timestamp  # Store App init time.
        self.creator_address = Global.creator_address  # Store App creator.

    # Define abimethod that opts user in to local storage
    @arc4.abimethod(allow_actions=["OptIn"])
    def local_storage(self, account: Account, mbr_pay: gtxn.PaymentTransaction) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            mbr_pay.amount == self.calc_mbr()
        ), "MBR payment must meet the minimum requirement amount."
        assert (
            mbr_pay.sender == account
        ), "MBR payment sender must match the account opting in."
        assert (
            mbr_pay.receiver == self.app_address
        ), "MBR payment reciever must be the App address."

        # Change local state var 'self.local_vote_status' (specific to account) value from 'None' to '0'
        self.local_vote_status[account] = UInt64(0)

        # Change local state var 'self.local_vote_choice' (specific to account) value from 'None' to '0'
        self.local_vote_choice[account] = UInt64(0)

        # Increment count for total accounts opted in
        self.total_accounts_opted_in += UInt64(1)

        # Log info on-chain
        log("Opt-in successful for account address: ", account)

    # Define abimethod that lets the user opt out
    @arc4.abimethod(allow_actions=["CloseOut"])
    def opt_out(self, account: Account) -> None:
        # Make necessary assertions to verify transaction requirements
        assert account.is_opted_in(
            Application(self.app_id.id)
        ), "Account must first be opted-in to App client in order to close out."

        assert (  # Account is opted-in but hasn't voted yet
            account.is_opted_in(Application(self.app_id.id))
            and self.local_vote_choice[account] == UInt64(0)
        ) or (  # Account is opted-in and has voted and voting period is over
            account.is_opted_in(Application(self.app_id.id))
            and self.local_vote_choice[account] != UInt64(0)
            and Global.latest_timestamp > self.vote_end_date_unix
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
            amount=self.calc_mbr() - min_txn_fee,
            sender=self.app_address,
            fee=min_txn_fee,
            note="MBR refund for closing out.",
        ).submit()

        # Log info on-chain
        log("Close-out successful for account address: ", account)

    # Define abimethod that sets the vote deadline (consider making it updatable)
    @arc4.abimethod()
    def set_vote_dates(
        self,
        vote_start_date_str: String,
        vote_start_date_unix: UInt64,
        vote_end_date_str: String,
        vote_end_date_unix: UInt64,
    ) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender == self.creator_address
        ), "Only App creator can set vote dates."

        # UNCOMMENT WHEN DONE TESTING!
        # assert (
        #     vote_start_date_unix >= Global.latest_timestamp
        # ), "Start date must be not be earlier than current date."

        # assert (
        #     vote_end_date_unix >= Global.latest_timestamp
        # ), "End date must not be earlier than the current timestamp."

        assert (
            vote_start_date_unix < vote_end_date_unix
        ), "Start date must be earlier than end date."

        assert vote_end_date_unix >= vote_start_date_unix + UInt64(
            3 * 24 * 60 * 60
        ), "End date must be at least 3 days later than the start date."

        assert vote_end_date_unix - vote_start_date_unix <= UInt64(
            14 * 24 * 60 * 60
        ), "Voting period can not exceed 14 days."

        assert self.vote_dates_final == UInt64(0), "Vote dates can only be set once."

        # Get and store vote dates in unix int format
        self.vote_start_date_unix = vote_start_date_unix
        self.vote_end_date_unix = vote_end_date_unix

        # Make vote dates final
        self.vote_dates_final = UInt64(1)

        # Log info on-chain
        log("Vote start date: ", vote_start_date_str)
        log("Vote end date: ", vote_end_date_str)

    # Define abimethod that lets the user cast their vote
    @arc4.abimethod
    def submit_vote(self, account: Account, choice: UInt64) -> None:
        # Make necessary assertions to verify transaction requirements
        assert account.is_opted_in(
            Application(self.app_id.id)
        ), "Account must be opted-in before voting."

        assert (
            Global.latest_timestamp > self.vote_start_date_unix
        ), "Voting period has not started yet."

        assert (
            Global.latest_timestamp < self.vote_end_date_unix
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
        self.total_vote_count += UInt64(1)

        # Update vote tally
        if choice == UInt64(1):
            self.choice1_vote_count += UInt64(1)
            self.local_vote_choice[account] = UInt64(1)
        elif choice == UInt64(2):
            self.choice2_vote_count += UInt64(1)
            self.local_vote_choice[account] = UInt64(2)
        else:
            self.choice3_vote_count += UInt64(1)
            self.local_vote_choice[account] = UInt64(3)

        # Log info on-chain
        log("Vote submitted successfully for account address: ", account)
        log("Vote submitted for choice number: ", choice)
