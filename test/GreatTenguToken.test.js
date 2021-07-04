const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

const GreatTenguToken = artifacts.require('GreatTenguToken');
const TenguToken = artifacts.require('TenguToken');

contract('GreatTenguToken', ([alice, bob, operator, owner]) => {
    beforeEach(async () => {
        this.gtengu = await GreatTenguToken.new({ from: owner });
        this.tengu = await TenguToken.new({ from: owner });
        await this.gtengu.setTenguContractAddress(this.tengu.address, { from: owner });
        await this.tengu.setGTenguContractAddress(this.gtengu.address, { from: owner });
        this.BURN_ADDRESS = await this.gtengu.BURN_ADDRESS();
        this.SWAP_TO_GTENGU_DEFAULT_FEE = await this.gtengu.swapTenguToGTenguFee();
        this.SWAP_TENGU_TO_GTENGU_MAX_FEE = await this.gtengu.SWAP_TENGU_TO_GTENGU_MAX_FEE();
    });

    describe('swapTenguToGTengu', () => {

        it('when amount of tengu to swap is 0', async () => {
            await expectRevert(this.gtengu.swapTenguToGTengu(0, { from: alice }), 'GTENGU::swapTenguToGTengu: amount 0');
        });

        it('when the amount to swap is > to the balance of the sender', async () => {
            await expectRevert(this.gtengu.swapTenguToGTengu(1000, { from: alice }), 'GTENGU::swapTenguToGTengu: not enough TENGU');
        });

        it('swap 1000 tengu', async () => {
            await this.tengu.mint(alice, 5000, { from: owner });
            const gTenguToMint = (await this.gtengu.getSwapTenguToGTenguAmount(1000)).toString();

            assert.equal((await this.tengu.balanceOf(alice)).toString(), '5000');

            await this.tengu.approve(this.gtengu.address, 1000, { from: alice });
            await this.gtengu.swapTenguToGTengu(1000, { from: alice });

            assert.equal((await this.tengu.balanceOf(this.BURN_ADDRESS)).toString(), '1000');
            assert.equal((await this.tengu.balanceOf(alice)).toString(), '4000');
            assert.equal((await this.gtengu.balanceOf(alice)).toString(), gTenguToMint);
        });

    });

    describe('setSwapTenguToGTenguFee', () => {

        it('when the sender is not the owner', async () => {
            await expectRevert(this.gtengu.setSwapTenguToGTenguFee(1000, { from: alice }), 'Ownable: caller is not the owner');
        });

        it('set fee to 0', async () => {
            const receipt = await this.gtengu.setSwapTenguToGTenguFee(0, { from: owner });

            assert.equal((await this.gtengu.swapTenguToGTenguFee()).toString(), '0');

            await expectEvent(receipt, 'SetSwapTenguToGTenguFee', {
                previousFee: this.SWAP_TO_GTENGU_DEFAULT_FEE.toString(),
                newFee: '0'
            });
        });

        it('set fee to max fee', async () => {
            const newFee = this.SWAP_TENGU_TO_GTENGU_MAX_FEE.toString();
            const receipt = await this.gtengu.setSwapTenguToGTenguFee(newFee, { from: owner });

            assert.equal((await this.gtengu.swapTenguToGTenguFee()).toString(), newFee);

            await expectEvent(receipt, 'SetSwapTenguToGTenguFee', {
                previousFee: this.SWAP_TO_GTENGU_DEFAULT_FEE.toString(),
                newFee: newFee
            });
        });

        it('when the swap fee to set is higher than the max authorized', async () => {
            const newFee = (this.SWAP_TENGU_TO_GTENGU_MAX_FEE + 1).toString();

            await expectRevert(this.gtengu.setSwapTenguToGTenguFee(newFee, { from: owner }), 'GTENGU::swapTenguToGTengu: fee too high');
        });

    });

    describe('getSwapTenguToGTenguAmount', () => {

        it('when the amount is 0', async () => {
            assert.equal((await this.gtengu.getSwapTenguToGTenguAmount(0)).toString(), '0');
        });

        it('is fee correctly calculated', async () => {
            const swapTenguToGTenguFee = await this.gtengu.swapTenguToGTenguFee()
            const tenguToSwap = 251;
            const gTenguToReceive = Math.trunc(tenguToSwap * (10000 - swapTenguToGTenguFee) / 10000);
            assert.equal((await this.gtengu.getSwapTenguToGTenguAmount(251)).toString(), gTenguToReceive.toString());
        });

    });

    describe('setTenguContractAddress', () => {

        it('has tengu contract address', async () => {
            assert.equal((await this.gtengu.tengu()), this.tengu.address);
        });

        it('when the sender is not the owner', async () => {
            await expectRevert(this.gtengu.setTenguContractAddress(this.tengu.address, { from: alice }), 'Ownable: caller is not the owner');
        });

        it('when the value has already been initialized', async () => {
            await expectRevert(this.gtengu.setTenguContractAddress(this.tengu.address, { from: owner }), 'GTENGU::setTenguContractAddress: already initialized');
        });

    });

});
