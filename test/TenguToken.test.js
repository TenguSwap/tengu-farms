const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

const TenguToken = artifacts.require('TenguToken');
const GreatTenguToken = artifacts.require('GreatTenguToken');

contract('TenguToken', ([alice, bob, carol, operator, owner]) => {
    beforeEach(async () => {
        this.tengu = await TenguToken.new({ from: owner });
        this.gtengu = await GreatTenguToken.new({ from: owner });
        await this.tengu.setGTenguContractAddress(this.gtengu.address, { from: owner });
        await this.gtengu.setTenguContractAddress(this.tengu.address, { from: owner });
        this.burnAddress = '0x000000000000000000000000000000000000dEaD';
        this.zeroAddress = '0x0000000000000000000000000000000000000000';
    });

    it('only operator', async () => {
        assert.equal((await this.tengu.owner()), owner);
        assert.equal((await this.tengu.operator()), owner);

        await expectRevert(this.tengu.updateTransferTaxRate(500, { from: operator }), 'operator: caller is not the operator');
        await expectRevert(this.tengu.updateBurnRate(20, { from: operator }), 'operator: caller is not the operator');
        await expectRevert(this.tengu.updateMaxTransferAmountRate(100, { from: operator }), 'operator: caller is not the operator');
        await expectRevert(this.tengu.setExcludedFromAntiWhale(operator, { from: operator }), 'operator: caller is not the operator');
        await expectRevert(this.tengu.updateTenguSwapRouter(operator, { from: operator }), 'operator: caller is not the operator');
        await expectRevert(this.tengu.updateMinAmountToLiquify(100, { from: operator }), 'operator: caller is not the operator');
        await expectRevert(this.tengu.transferOperator(alice, { from: operator }), 'operator: caller is not the operator');
    });

    it('transfer operator', async () => {
        await expectRevert(this.tengu.transferOperator(operator, { from: operator }), 'operator: caller is not the operator');
        await this.tengu.transferOperator(operator, { from: owner });
        assert.equal((await this.tengu.operator()), operator);

        await expectRevert(this.tengu.transferOperator(this.zeroAddress, { from: operator }), 'TENGU::transferOperator: new operator is the zero address');
    });

    it('update transfer tax rate', async () => {
        await this.tengu.transferOperator(operator, { from: owner });
        assert.equal((await this.tengu.operator()), operator);

        assert.equal((await this.tengu.transferTaxRate()).toString(), '800');
        assert.equal((await this.tengu.burnRate()).toString(), '25');

        await this.tengu.updateTransferTaxRate(0, { from: operator });
        assert.equal((await this.tengu.transferTaxRate()).toString(), '0');
        await this.tengu.updateTransferTaxRate(1000, { from: operator });
        assert.equal((await this.tengu.transferTaxRate()).toString(), '1000');
        await expectRevert(this.tengu.updateTransferTaxRate(1001, { from: operator }), 'TENGU::updateTransferTaxRate: Transfer tax rate must not exceed the maximum rate.');

        await this.tengu.updateGTenguRate(40, { from: operator });
        await this.tengu.updateBurnRate(0, { from: operator });
        assert.equal((await this.tengu.burnRate()).toString(), '0');
        await this.tengu.updateBurnRate(60, { from: operator });
        assert.equal((await this.tengu.burnRate()).toString(), '60');
        await expectRevert(this.tengu.updateBurnRate(61, { from: operator }), 'TENGU::updateBurnRate: GTengu + burn rates must not exceed the maximum rate.');
    });

    it('transfer', async () => {
        await this.tengu.transferOperator(operator, { from: owner });
        assert.equal((await this.tengu.operator()), operator);

        await this.tengu.mint(alice, 10000000, { from: owner }); // max transfer amount 25,000
        assert.equal((await this.tengu.balanceOf(alice)).toString(), '10000000');
        assert.equal((await this.tengu.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.tengu.balanceOf(this.tengu.address)).toString(), '0');

        let receipt = await this.tengu.transfer(bob, 12345, { from: alice });
        assert.equal((await this.tengu.balanceOf(alice)).toString(), '9987655');
        assert.equal((await this.tengu.balanceOf(bob)).toString(), '11358');
        assert.equal((await this.tengu.balanceOf(this.burnAddress)).toString(), '739');
        assert.equal((await this.tengu.balanceOf(this.tengu.address)).toString(), '248');
        await expectEvent.inTransaction(receipt.tx, this.gtengu, 'SwapToGTengu', {
            sender: this.tengu.address,
            recipient: alice,
            tenguAmount: '493'
        });

        await this.tengu.approve(carol, 22345, { from: alice });
        receipt = await this.tengu.transferFrom(alice, carol, 22345, { from: carol });
        assert.equal((await this.tengu.balanceOf(alice)).toString(), '9965310');
        assert.equal((await this.tengu.balanceOf(carol)).toString(), '20558');
        assert.equal((await this.tengu.balanceOf(this.burnAddress)).toString(), '2078');
        assert.equal((await this.tengu.balanceOf(this.tengu.address)).toString(), '696');
        await expectEvent.inTransaction(receipt.tx, this.gtengu, 'SwapToGTengu', {
            sender: this.tengu.address,
            recipient: alice,
            tenguAmount: '893'
        });
    });

    it('transfer small amount', async () => {
        await this.tengu.transferOperator(operator, { from: owner });
        assert.equal((await this.tengu.operator()), operator);

        await this.tengu.mint(alice, 10000000, { from: owner });
        assert.equal((await this.tengu.balanceOf(alice)).toString(), '10000000');
        assert.equal((await this.tengu.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.tengu.balanceOf(this.tengu.address)).toString(), '0');

        await this.tengu.transfer(bob, 11, { from: alice });
        assert.equal((await this.tengu.balanceOf(alice)).toString(), '9999989');
        assert.equal((await this.tengu.balanceOf(bob)).toString(), '11');
        assert.equal((await this.tengu.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.tengu.balanceOf(this.tengu.address)).toString(), '0');
    });

    it('transfer without transfer tax', async () => {
        await this.tengu.transferOperator(operator, { from: owner });
        assert.equal((await this.tengu.operator()), operator);

        assert.equal((await this.tengu.transferTaxRate()).toString(), '800');
        assert.equal((await this.tengu.burnRate()).toString(), '25');

        await this.tengu.updateTransferTaxRate(0, { from: operator });
        assert.equal((await this.tengu.transferTaxRate()).toString(), '0');

        await this.tengu.mint(alice, 10000000, { from: owner });
        assert.equal((await this.tengu.balanceOf(alice)).toString(), '10000000');
        assert.equal((await this.tengu.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.tengu.balanceOf(this.tengu.address)).toString(), '0');

        await this.tengu.transfer(bob, 10000, { from: alice });
        assert.equal((await this.tengu.balanceOf(alice)).toString(), '9990000');
        assert.equal((await this.tengu.balanceOf(bob)).toString(), '10000');
        assert.equal((await this.tengu.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.tengu.balanceOf(this.tengu.address)).toString(), '0');
    });

    it('transfer without burn', async () => {
        await this.tengu.transferOperator(operator, { from: owner });
        assert.equal((await this.tengu.operator()), operator);

        assert.equal((await this.tengu.transferTaxRate()).toString(), '800');
        assert.equal((await this.tengu.burnRate()).toString(), '25');

        await this.tengu.updateBurnRate(0, { from: operator });
        assert.equal((await this.tengu.burnRate()).toString(), '0');

        await this.tengu.mint(alice, 10000000, { from: owner });
        assert.equal((await this.tengu.balanceOf(alice)).toString(), '10000000');
        assert.equal((await this.tengu.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.tengu.balanceOf(this.tengu.address)).toString(), '0');

        await this.tengu.transfer(bob, 1234, { from: alice });
        assert.equal((await this.tengu.balanceOf(alice)).toString(), '9998766');
        assert.equal((await this.tengu.balanceOf(bob)).toString(), '1136');
        assert.equal((await this.tengu.balanceOf(this.burnAddress)).toString(), '49');
        assert.equal((await this.tengu.balanceOf(this.tengu.address)).toString(), '49');
    });

    it('transfer all burn', async () => {
        await this.tengu.transferOperator(operator, { from: owner });
        assert.equal((await this.tengu.operator()), operator);

        assert.equal((await this.tengu.transferTaxRate()).toString(), '800');
        assert.equal((await this.tengu.burnRate()).toString(), '25');

        await this.tengu.updateGTenguRate(0, { from: operator });
        await this.tengu.updateBurnRate(100, { from: operator });
        assert.equal((await this.tengu.burnRate()).toString(), '100');

        await this.tengu.mint(alice, 10000000, { from: owner });
        assert.equal((await this.tengu.balanceOf(alice)).toString(), '10000000');
        assert.equal((await this.tengu.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.tengu.balanceOf(this.tengu.address)).toString(), '0');

        await this.tengu.transfer(bob, 1234, { from: alice });
        assert.equal((await this.tengu.balanceOf(alice)).toString(), '9998766');
        assert.equal((await this.tengu.balanceOf(bob)).toString(), '1136');
        assert.equal((await this.tengu.balanceOf(this.burnAddress)).toString(), '98');
        assert.equal((await this.tengu.balanceOf(this.tengu.address)).toString(), '0');
    });

    it('max transfer amount', async () => {
        assert.equal((await this.tengu.maxTransferAmountRate()).toString(), '50');
        assert.equal((await this.tengu.maxTransferAmount()).toString(), '0');

        await this.tengu.mint(alice, 1000000, { from: owner });
        assert.equal((await this.tengu.maxTransferAmount()).toString(), '5000');

        await this.tengu.mint(alice, 1000, { from: owner });
        assert.equal((await this.tengu.maxTransferAmount()).toString(), '5005');

        await this.tengu.transferOperator(operator, { from: owner });
        assert.equal((await this.tengu.operator()), operator);

        await this.tengu.updateMaxTransferAmountRate(100, { from: operator }); // 1%
        assert.equal((await this.tengu.maxTransferAmount()).toString(), '10010');

        await expectRevert(this.tengu.updateMaxTransferAmountRate(10001, { from: operator }), 'TENGU::updateMaxTransferAmountRate: Max transfer amount rate must not exceed the maximum rate.');
        await expectRevert(this.tengu.updateMaxTransferAmountRate(9, { from: operator }), 'TENGU::updateMaxTransferAmountRate: Min transfer amount rate must be above the minimum rate.');
    });

    it('anti whale', async () => {
        await this.tengu.transferOperator(operator, { from: owner });
        assert.equal((await this.tengu.operator()), operator);

        assert.equal((await this.tengu.isExcludedFromAntiWhale(operator)), false);
        await this.tengu.setExcludedFromAntiWhale(operator, true, { from: operator });
        assert.equal((await this.tengu.isExcludedFromAntiWhale(operator)), true);



        await this.tengu.mint(alice, 10000, { from: owner });
        await this.tengu.mint(bob, 10000, { from: owner });
        await this.tengu.mint(carol, 10000, { from: owner });
        await this.tengu.mint(operator, 10000, { from: owner });
        await this.tengu.mint(owner, 10000, { from: owner });

        // total supply: 50,000, max transfer amount: 250
        assert.equal((await this.tengu.maxTransferAmount()).toString(), '250');
        await expectRevert(this.tengu.transfer(bob, 251, { from: alice }), 'TENGU::antiWhale: Transfer amount exceeds the maxTransferAmount');
        await this.tengu.approve(carol, 251, { from: alice });
        await expectRevert(this.tengu.transferFrom(alice, carol, 251, { from: carol }), 'TENGU::antiWhale: Transfer amount exceeds the maxTransferAmount');

        //
        await this.tengu.transfer(bob, 250, { from: alice });
        await this.tengu.transferFrom(alice, carol, 250, { from: carol });

        await this.tengu.transfer(this.burnAddress, 251, { from: alice });
        await this.tengu.transfer(operator, 251, { from: alice });
        await this.tengu.transfer(owner, 251, { from: alice });
        await this.tengu.transfer(this.tengu.address, 251, { from: alice });

        await this.tengu.transfer(alice, 251, { from: operator });
        await this.tengu.transfer(alice, 251, { from: owner });
        await this.tengu.transfer(owner, 251, { from: operator });
    });

    it('update min amount to liquify', async () => {
        await expectRevert(this.tengu.updateMinAmountToLiquify(100, { from: operator }), 'operator: caller is not the operator');
        assert.equal((await this.tengu.minAmountToLiquify()).toString(), '500000000000000000000');

        await this.tengu.transferOperator(operator, { from: owner });
        assert.equal((await this.tengu.operator()), operator);

        await this.tengu.updateMinAmountToLiquify(100, { from: operator });
        assert.equal((await this.tengu.minAmountToLiquify()).toString(), '100');
    });

    it('update locker', async () => {
        await expectRevert(this.tengu.updateLocker(operator, { from: bob }), 'operator: caller is not the operator');
        await expectRevert(this.tengu.updateLocker(this.zeroAddress, { from: owner }), 'TENGU::updateTenguLocker: new operator is the zero address');
        await this.tengu.updateLocker(operator, { from: owner });
    });
});
