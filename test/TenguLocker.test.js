const { expectRevert } = require('@openzeppelin/test-helpers');
const { assert } = require("chai");
const TenguLocker = artifacts.require('TenguLocker');
const MockBEP20 = artifacts.require('libs/MockBEP20');


contract('TenguLocker', ([alice, bob, carol, owner]) => {
    beforeEach(async () => {
        this.lp1 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: owner });
        this.tenguLocker = await TenguLocker.new({ from: owner });
    });

    it('only owner', async () => {
        assert.equal((await this.tenguLocker.owner()), owner);

        // lock
        await this.lp1.transfer(this.tenguLocker.address, '2000', { from: owner });
        assert.equal((await this.lp1.balanceOf(this.tenguLocker.address)).toString(), '2000');

        await expectRevert(this.tenguLocker.unlock(this.lp1.address, bob, { from: bob }), 'Ownable: caller is not the owner');
        await this.tenguLocker.unlock(this.lp1.address, carol, { from: owner });
        assert.equal((await this.lp1.balanceOf(carol)).toString(), '2000');
        assert.equal((await this.lp1.balanceOf(this.tenguLocker.address)).toString(), '0');
    });
})
