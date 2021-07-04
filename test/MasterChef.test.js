const { expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { assert } = require("chai");
const TenguToken = artifacts.require('TenguToken');
const MasterChef = artifacts.require('MasterChef');
const MockBEP20 = artifacts.require('libs/MockBEP20');
const TenguReferral = artifacts.require('TenguReferral');

contract('MasterChef', ([alice, bob, carol, referrer, treasury, dev, fee, owner]) => {
    beforeEach(async () => {
        this.zeroAddress = '0x0000000000000000000000000000000000000000';
        this.tengu = await TenguToken.new({ from: owner });
        this.referral = await TenguReferral.new({ from: owner });
        this.chef = await MasterChef.new(this.tengu.address, '100', '1000', { from: owner });

        await this.tengu.transferOwnership(this.chef.address, { from: owner });
        await this.referral.transferOwnership(this.chef.address, { from: owner });
        await this.chef.setTenguReferral(this.referral.address, { from: owner });

        this.lp1 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: owner });
        this.lp2 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: owner });
        this.lp3 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: owner });
        this.lp4 = await MockBEP20.new('LPToken', 'LP4', '1000000', { from: owner });

        await this.lp1.transfer(alice, '2000', { from: owner });
        await this.lp2.transfer(alice, '2000', { from: owner });
        await this.lp3.transfer(alice, '2000', { from: owner });
        await this.lp4.transfer(alice, '2000', { from: owner });

        await this.lp1.transfer(bob, '2000', { from: owner });
        await this.lp2.transfer(bob, '2000', { from: owner });
        await this.lp3.transfer(bob, '2000', { from: owner });
        await this.lp4.transfer(bob, '2000', { from: owner });

        await this.lp1.transfer(carol, '2000', { from: owner });
        await this.lp2.transfer(carol, '2000', { from: owner });
        await this.lp3.transfer(carol, '2000', { from: owner });
        await this.lp4.transfer(carol, '2000', { from: owner });
    });

    it('manage pools', async () => {
        await expectRevert(this.chef.add('1000', this.lp1.address, '401', '3600', true, { from: owner }), 'add: invalid deposit fee basis points');
        await expectRevert(this.chef.add('1000', this.lp1.address, '400', '3600000000', true, { from: owner }), 'add: invalid harvest interval');
        let receipt = await this.chef.add('1000', this.lp1.address, '400', '3600', true, { from: owner });
        assert.equal((await this.chef.poolInfo(0)).allocPoint.toString(), '1000');
        assert.equal((await this.chef.poolInfo(0)).depositFeeBP.toString(), '400');
        assert.equal((await this.chef.poolInfo(0)).harvestInterval.toString(), '3600');
        await expectEvent.inTransaction(receipt.tx, this.chef, 'AddPool', {
            pid: '0',
            allocPoint: '1000',
            lpTokenAddress: this.lp1.address,
            depositFeeBP: '400',
            harvestInterval: '3600'
        });

        await expectRevert(this.chef.set(0, '2000', '401', '3600', true, { from: owner }), 'set: invalid deposit fee basis points');
        await expectRevert(this.chef.set(0, '2000', '100', '3600000000', true, { from: owner }), 'set: invalid harvest interval');
        receipt = await this.chef.set(0, '2000', '100', '1800', true, { from: owner });
        assert.equal((await this.chef.poolInfo(0)).allocPoint.toString(), '2000');
        assert.equal((await this.chef.poolInfo(0)).depositFeeBP.toString(), '100');
        assert.equal((await this.chef.poolInfo(0)).harvestInterval.toString(), '1800');
        await expectEvent.inTransaction(receipt.tx, this.chef, 'SetPool', {
            pid: '0',
            allocPoint: '2000',
            depositFeeBP: '100',
            harvestInterval: '1800'
        });
    })

    it('deposit fee', async () => {
        assert.equal((await this.chef.owner()), owner);
        assert.equal((await this.chef.feeAddress()), owner);

        let receipt = await this.chef.setFeeAddress(fee, { from: owner });
        assert.equal((await this.chef.feeAddress()), fee);
        await expectEvent.inTransaction(receipt.tx, this.chef, 'SetFeeAddress', {
            previousFeeAddress: owner,
            newFeeAddress: fee
        });

        await this.chef.add('1000', this.lp1.address, '400', '3600', true, { from: owner });
        await this.chef.add('2000', this.lp2.address, '0', '3600', true, { from: owner });

        await this.lp1.approve(this.chef.address, '1000', { from: alice });
        await this.lp2.approve(this.chef.address, '1000', { from: alice });

        assert.equal((await this.lp1.balanceOf(fee)).toString(), '0');
        await this.chef.deposit(0, '100', referrer, { from: alice });
        assert.equal((await this.lp1.balanceOf(fee)).toString(), '4');

        await this.chef.set(0, '1000', '100', '3600', true, { from: owner });
        await this.chef.deposit(0, '100', referrer, { from: alice });
        assert.equal((await this.lp1.balanceOf(fee)).toString(), '5');

        assert.equal((await this.lp2.balanceOf(fee)).toString(), '0');
        await this.chef.deposit(1, '100', referrer, { from: alice });
        assert.equal((await this.lp2.balanceOf(fee)).toString(), '0');
    });

    it('only dev', async () => {
        assert.equal((await this.chef.owner()), owner);
        assert.equal((await this.chef.devAddress()), owner);

        await expectRevert(this.chef.setDevAddress(dev, { from: dev }), 'setDevAddress: FORBIDDEN');
        let receipt = await this.chef.setDevAddress(dev, { from: owner });
        assert.equal((await this.chef.devAddress()), dev);
        await expectEvent.inTransaction(receipt.tx, this.chef, 'SetDevAddress', {
            previousDevAddress: owner,
            newDevAddress: dev
        });

        await expectRevert(this.chef.setDevAddress(this.zeroAddress, { from: dev }), 'setDevAddress: ZERO');
    });

    it('only fee', async () => {
        assert.equal((await this.chef.owner()), owner);
        assert.equal((await this.chef.feeAddress()), owner);

        await expectRevert(this.chef.setFeeAddress(fee, { from: fee }), 'setFeeAddress: FORBIDDEN');
        await this.chef.setFeeAddress(fee, { from: owner });
        assert.equal((await this.chef.feeAddress()), fee);

        await expectRevert(this.chef.setFeeAddress(this.zeroAddress, { from: fee }), 'setFeeAddress: ZERO');
    });

    it('referral', async() => {
        await expectRevert(this.chef.setReferralCommissionRate(1001, { from: owner }), 'setReferralCommissionRate: invalid referral commission rate basis points');
        let receipt = await this.chef.setReferralCommissionRate(200, { from: owner });
        assert.equal((await this.chef.referralCommissionRate()), '200');
        await expectEvent.inTransaction(receipt.tx, this.chef, 'SetReferralCommissionRate', {
            previousReferralCommissionRate: '100',
            newReferralCommissionRate: '200'
        });

        receipt = await this.chef.setTenguReferral(bob, { from: owner });
        assert.equal((await this.chef.tenguReferral()), bob);
        await expectEvent.inTransaction(receipt.tx, this.chef, 'SetTenguReferral', {
            previousTenguReferral: this.referral.address,
            newTenguReferral: bob
        });
    });
});
