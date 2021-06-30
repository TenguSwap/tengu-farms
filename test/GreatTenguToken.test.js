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
        this.SWAP_TO_GTENGU_DEFAULT_FEE = await this.gtengu.swapToGTenguFee();
        this.SWAP_TO_GTENGU_MAX_FEE = await this.gtengu.SWAP_TO_GTENGU_MAX_FEE();
    });

    describe('swapToGTengu', () => {

        it('when amount of tengu to swap is 0', async () => {
            await expectRevert(this.gtengu.swapToGTengu(0, { from: alice }), 'GTENGU::swapToGTengu: amount 0');
        });

        it('when the amount to swap is > to the balance of the sender', async () => {
            await expectRevert(this.gtengu.swapToGTengu(1000, { from: alice }), 'GTENGU::swapToGTengu: not enough TENGU');
        });

        it('swap 1000 tengu', async () => {
            await this.tengu.mint(alice, 5000, { from: owner });
            const gTenguToMint = (await this.gtengu.getSwapToGTenguAmount(1000)).toString();

            assert.equal((await this.tengu.balanceOf(alice)).toString(), '5000');

            await this.tengu.approve(this.gtengu.address, 1000, { from: alice });
            await this.gtengu.swapToGTengu(1000, { from: alice });

            assert.equal((await this.tengu.balanceOf(this.BURN_ADDRESS)).toString(), '1000');
            assert.equal((await this.tengu.balanceOf(alice)).toString(), '4000');
            assert.equal((await this.gtengu.balanceOf(alice)).toString(), gTenguToMint);
        });

    });

    describe('setSwapToGTenguFee', () => {

        it('when the sender is not the owner', async () => {
            await expectRevert(this.gtengu.setSwapToGTenguFee(1000, { from: alice }), 'Ownable: caller is not the owner');
        });

        it('set fee to 0', async () => {
            const receipt = await this.gtengu.setSwapToGTenguFee(0, { from: owner });

            assert.equal((await this.gtengu.swapToGTenguFee()).toString(), '0');

            await expectEvent(receipt, 'SetSwapToGTenguFee', {
                previousFee: this.SWAP_TO_GTENGU_DEFAULT_FEE.toString(),
                newFee: '0'
            });
        });

        it('set fee to max fee', async () => {
            const newFee = this.SWAP_TO_GTENGU_MAX_FEE.toString();
            const receipt = await this.gtengu.setSwapToGTenguFee(newFee, { from: owner });

            assert.equal((await this.gtengu.swapToGTenguFee()).toString(), newFee);

            await expectEvent(receipt, 'SetSwapToGTenguFee', {
                previousFee: this.SWAP_TO_GTENGU_DEFAULT_FEE.toString(),
                newFee: newFee
            });
        });

        it('when the swap fee to set is higher than the max authorized', async () => {
            const newFee = (this.SWAP_TO_GTENGU_MAX_FEE + 1).toString();

            await expectRevert(this.gtengu.setSwapToGTenguFee(newFee, { from: owner }), 'GTENGU::swapToGTengu: fee too high');
        });

    });

    describe('getSwapToGTenguAmount', () => {

        it('when the amount is 0', async () => {
            assert.equal((await this.gtengu.getSwapToGTenguAmount(0)).toString(), '0');
        });

        it('is fee correctly calculated', async () => {
            const swapToGTenguFee = await this.gtengu.swapToGTenguFee()
            const tenguToSwap = 251;
            const gTenguToReceive = Math.trunc(tenguToSwap * (10000 - swapToGTenguFee) / 10000);
            assert.equal((await this.gtengu.getSwapToGTenguAmount(251)).toString(), gTenguToReceive.toString());
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
