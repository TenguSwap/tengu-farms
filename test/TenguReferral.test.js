const { expectRevert } = require('@openzeppelin/test-helpers');
const { assert } = require("chai");

const TenguReferral = artifacts.require('TenguReferral');

contract('TenguReferral', ([alice, bob, carol, referrer, operator, owner]) => {
    beforeEach(async () => {
        this.tenguReferral = await TenguReferral.new({ from: owner });
        this.zeroAddress = '0x0000000000000000000000000000000000000000';
    });

    it('should allow operator and only owner to update operator', async () => {
        assert.equal((await this.tenguReferral.operator()), owner);
        await expectRevert(this.tenguReferral.recordReferral(alice, referrer, { from: operator }), 'Ownable: caller is not the owner');

        await expectRevert(this.tenguReferral.updateOperator(operator, { from: carol }), 'Operator: caller is not the operator');
        await this.tenguReferral.updateOperator(operator, { from: owner });
        assert.equal((await this.tenguReferral.operator()), operator);
    });

    it('record referral', async () => {
        assert.equal((await this.tenguReferral.operator()), owner);

        await this.tenguReferral.recordReferral(this.zeroAddress, referrer, { from: owner });
        await this.tenguReferral.recordReferral(alice, this.zeroAddress, { from: owner });
        await this.tenguReferral.recordReferral(this.zeroAddress, this.zeroAddress, { from: owner });
        await this.tenguReferral.recordReferral(alice, alice, { from: owner });
        assert.equal((await this.tenguReferral.getReferrer(alice)).valueOf(), this.zeroAddress);
        assert.equal((await this.tenguReferral.referralsCount(referrer)).valueOf(), '0');

        await this.tenguReferral.recordReferral(alice, referrer, { from: owner });
        assert.equal((await this.tenguReferral.getReferrer(alice)).valueOf(), referrer);
        assert.equal((await this.tenguReferral.referralsCount(referrer)).valueOf(), '1');

        assert.equal((await this.tenguReferral.referralsCount(bob)).valueOf(), '0');
        await this.tenguReferral.recordReferral(alice, bob, { from: owner });
        assert.equal((await this.tenguReferral.referralsCount(bob)).valueOf(), '0');
        assert.equal((await this.tenguReferral.getReferrer(alice)).valueOf(), referrer);

        await this.tenguReferral.recordReferral(carol, referrer, { from: owner });
        assert.equal((await this.tenguReferral.getReferrer(carol)).valueOf(), referrer);
        assert.equal((await this.tenguReferral.referralsCount(referrer)).valueOf(), '2');
    });

    it('record referral commission', async () => {
        assert.equal((await this.tenguReferral.totalReferralCommissions(referrer)).valueOf(), '0');

        await expectRevert(this.tenguReferral.recordReferralCommission(referrer, 1, { from: operator }), 'Ownable: caller is not the owner');

        await this.tenguReferral.recordReferralCommission(referrer, 1, { from: owner });
        assert.equal((await this.tenguReferral.totalReferralCommissions(referrer)).valueOf(), '1');

        await this.tenguReferral.recordReferralCommission(referrer, 0, { from: owner });
        assert.equal((await this.tenguReferral.totalReferralCommissions(referrer)).valueOf(), '1');

        await this.tenguReferral.recordReferralCommission(referrer, 111, { from: owner });
        assert.equal((await this.tenguReferral.totalReferralCommissions(referrer)).valueOf(), '112');

        await this.tenguReferral.recordReferralCommission(this.zeroAddress, 100, { from: owner });
        assert.equal((await this.tenguReferral.totalReferralCommissions(this.zeroAddress)).valueOf(), '0');
    });
});
