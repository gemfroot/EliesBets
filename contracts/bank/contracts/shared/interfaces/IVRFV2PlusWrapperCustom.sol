// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import {IVRFV2PlusWrapper} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFV2PlusWrapper.sol";

interface IVRFV2PlusWrapperCustom is IVRFV2PlusWrapper {
 function getConfig()
 external
 view
 returns (
 int256 fallbackWeiPerUnitLink,
 uint32 stalenessSeconds,
 uint32 fulfillmentFlatFeeNativePPM,
 uint32 fulfillmentFlatFeeLinkDiscountPPM,
 uint32 wrapperGasOverhead,
 uint32 coordinatorGasOverheadNative,
 uint32 coordinatorGasOverheadLink,
 uint16 coordinatorGasOverheadPerWord,
 uint8 wrapperNativePremiumPercentage,
 uint8 wrapperLinkPremiumPercentage,
 bytes32 keyHash,
 uint8 maxNumWords
 );
}
