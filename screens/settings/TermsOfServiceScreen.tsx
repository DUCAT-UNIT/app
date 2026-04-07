/**
 * TermsOfServiceScreen Component
 * Displays the Terms of Service in a scrollable view
 */

import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import ScreenLayout from '../../components/layouts/ScreenLayout';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = require('react-native').Dimensions.get('window');

// Responsive horizontal padding
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

/**
 * Props for the TermsOfServiceScreen component
 */
interface TermsOfServiceScreenProps {
  /** Navigation route object containing params */
  route: {
    /** Route parameters */
    params: {
      /** Callback to close the screen */
      onClose: () => void;
    };
  };
}

const TermsOfServiceScreen = React.memo(function TermsOfServiceScreen({ route }: TermsOfServiceScreenProps): React.ReactElement {
  const { onClose } = route.params;

  return (
    <ScreenLayout testID="terms-of-service-screen">
      {/* Header with back button and title on same line */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={onClose} style={localStyles.backButton} testID="terms-back-btn">
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={localStyles.title}>Terms of Service</Text>
      </View>

      <ScrollView style={localStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={localStyles.content}>
          <Text style={localStyles.lastUpdated}>Last Updated: January 2026</Text>

          <Text style={localStyles.paragraph}>
            These Terms of Service (these "Terms" or this "Agreement") are a contract between you and Ducat Protocol Inc. ("Ducat," "we," "our," or "us"), and governs your access to or use of the website at http://ducatprotocol.com (the "Platform") and any and all related services, products, software, applications, and features we may offer from time to time (collectively, the "Services").
          </Text>

          <Text style={localStyles.paragraph}>
            Your acceptance of these Terms occurs when you access or use the Services, or, if earlier, by clicking on an "I Agree" button or check box presented with these Terms. Upon taking any of the foregoing actions, you agree to be bound by this Agreement, our Privacy Policy, and any materials expressly incorporated herein.
          </Text>

          <Text style={localStyles.importantNotice}>
            THESE TERMS INCLUDE A WAIVER OF ANY RIGHT TO PARTICIPATE IN A CLASS ACTION, AS WELL AS A MANDATORY ARBITRATION CLAUSE THAT GOVERNS RESOLUTION OF CERTAIN DISPUTES AND WAIVES YOUR RIGHT TO SUE IN COURT OR HAVE A TRIAL BY JURY. YOU AGREE ANY DISPUTES RELATING TO THE SERVICES WILL BE RESOLVED BY BINDING ARBITRATION, AND YOU WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION PURSUANT TO THE TERMS BELOW. PLEASE READ SECTION 19 CAREFULLY.
          </Text>

          <Text style={localStyles.importantNotice}>
            IF YOU DO NOT AGREE TO THESE TERMS, YOU MAY NOT ACCESS OR USE THE SERVICES, AND DUCAT SHALL NOT GRANT, OR BE DEEMED TO GRANT TO YOU, THE LICENSE TO ACCESS AND USE THE SERVICES.
          </Text>

          <Text style={localStyles.sectionTitle}>1. ELIGIBILITY</Text>

          <Text style={localStyles.subSectionTitle}>1.1 Generally</Text>
          <Text style={localStyles.paragraph}>
            If you are an individual accessing or using the Services, you represent and warrant that you: (a) are at least 18 years old; (b) are capable of forming a binding contract with us in the jurisdiction you reside in; (c) have the full right, power, and authority to agree to these Terms; (d) are not a Restricted User (defined below); and (e) are using the Services solely for your own benefit and not on behalf of, or for the benefit of, any third party. If you interact with the Services on behalf of a legal entity or organization, you also represent and warrant to us that you are authorized to agree to these Terms on behalf of such legal entity or organization and you have the power and authority to bind the legal entity or organization to these Terms.
          </Text>

          <Text style={localStyles.subSectionTitle}>1.2 Restricted Users</Text>
          <Text style={localStyles.paragraph}>
            You represent and warrant to Ducat that you are not a "Restricted User," which is any individual, legal entity, or organization who/that is:
          </Text>
          <Text style={localStyles.listItem}>
            (a) located in, under the control of, or a resident of any jurisdiction that is comprehensively sanctioned or embargoed by the United States, the United Nations, or the United Kingdom;
          </Text>
          <Text style={localStyles.listItem}>
            (b) a resident, national, or agent of Cuba, certain sanctioned areas of Russia and Ukraine (including without limitation, Crimea, the so-called region of Donetsk, the so-called region of Luhansk, and the so-called region of Zaporizhzhia), Democratic People's Republic of Korea (North Korea), Iran, and Syria;
          </Text>
          <Text style={localStyles.listItem}>
            (c) a citizen, resident, located in, or organized in a jurisdiction where your access or use of the Services would be illegal or violate applicable law; or
          </Text>
          <Text style={localStyles.listItem}>
            (d) subject to any export restriction, end-user restriction, anti-terrorism law, anti-money laundering law, economic sanction, financial sanction, or trade embargo imposed, administered, or enforced by the United States Department of Treasury's Office of Foreign Asset Control, United States Department of State, United States Department of Commerce, United Nations Security Council, or any other applicable national, regional, provincial, state, municipal, or local law or regulation.
          </Text>

          <Text style={localStyles.sectionTitle}>2. DIGITAL ASSET WALLETS</Text>
          <Text style={localStyles.paragraph}>
            To use certain functions of the Services, you must connect a compatible software application (or other mechanism) ("Digital Asset Wallet"). Users use third-party self-custodial Digital Asset Wallets to interact with the Protocol (as defined below). We are not intermediaries to any blockchain transactions. We have no control or guarantee over the wallets. Your relationship with the provider of any Digital Asset Wallet you use in connection with the Services is governed by the terms and conditions of that provider's agreement with you.
          </Text>

          <Text style={localStyles.subSectionTitle}>2.1 Non-Custodial</Text>
          <Text style={localStyles.paragraph}>
            The Services are non-custodial applications. We do not, at any time, custody, possess, or control the virtual currency, cryptocurrency, stablecoins, or other cryptographic tokens (collectively, "Digital Assets") in your Digital Asset Wallet. As the owner of the Digital Assets stored by the Digital Asset Wallet, you acknowledge and agree that you bear all risk of loss regarding such Digital Assets and you will not hold us liable for Digital Asset fluctuations or other loss associated with any Digital Asset Wallet you use in connection with the Services.
          </Text>

          <Text style={localStyles.subSectionTitle}>2.2 Security</Text>
          <Text style={localStyles.paragraph}>
            You are solely responsible for the custody of the cryptographic private keys associated with any Digital Asset Wallet you use or connect to the Services. You should never share your Digital Asset Wallet credentials or seed phrase with anyone.
          </Text>

          <Text style={localStyles.sectionTitle}>3. THE PLATFORM</Text>
          <Text style={localStyles.paragraph}>
            The Platform provides a web or mobile-based means to access and interact with the Ducat Protocol on runs on the Bitcoin blockchain network (collectively, the "Protocol"). The Protocol enables users to perform transactions with Digital Assets compatible with the underlying blockchain network. The Platform is distinct from the Protocol. The Platform is one but not the exclusive means of accessing the Protocol. The Protocol itself is comprised of open-source or source-available self-executing smart contracts.
          </Text>

          <Text style={localStyles.sectionTitle}>4. THIRD-PARTY SERVICES AND WAIVER</Text>
          <Text style={localStyles.paragraph}>
            The Services may include, without limitation, links to sites, technology, applications, products, services, materials, or resources, provided or made available by a third party including, without limitation, the Protocol (collectively, "Third Party Services"). Your access and/or use of a Third-Party Service is subject to the terms and policies of the applicable provider of the Third-Party Service. We do not control any Third-Party Service.
          </Text>

          <Text style={localStyles.sectionTitle}>5. RISK DISCLOSURES</Text>
          <Text style={localStyles.paragraph}>
            You understand, accept, and agree to assume all of the various risks involved in using the Services and holding, transacting, and transferring Digital Assets including:
          </Text>
          <Text style={localStyles.listItem}>
            (a) Digital Assets, the features, functions, characteristics, operations, use, and other properties and/or software, networks, protocols, systems, or other technology that Digital Assets interact with are complex.
          </Text>
          <Text style={localStyles.listItem}>
            (b) If you act as a liquidity provider through the Services, you understand that your Digital Asset may lose some or all value while supplied to the Protocol due to fluctuations in Digital Asset prices.
          </Text>
          <Text style={localStyles.listItem}>
            (c) Digital Assets will be irretrievably lost if sent to the wrong address.
          </Text>
          <Text style={localStyles.listItem}>
            (d) Blockchain networks and Digital Assets may be subject to forks or attacks on the security, integrity, and/or operation of the networks.
          </Text>
          <Text style={localStyles.listItem}>
            (e) Digital Assets may decrease in value or lose all value, in a short period of time or permanently.
          </Text>

          <Text style={localStyles.sectionTitle}>6. ACKNOWLEDGEMENTS AND COVENANTS</Text>
          <Text style={localStyles.paragraph}>
            By accessing or using the Services, you acknowledge, agree, represent, and warrant that you have received a copy of, have carefully read, understand, accept, and agree to assume all of the risks involved with using, holding, trading, delivering, purchasing transacting, and/or transferring Digital Assets and access or use of the Services.
          </Text>

          <Text style={localStyles.sectionTitle}>7. PROHIBITED USE</Text>
          <Text style={localStyles.paragraph}>
            You may not use the Services to engage in the following categories of activity:
          </Text>
          <Text style={localStyles.listItem}>
            (a) Unlawful Activity - Activity which would violate any law, statute, ordinance, or regulation.
          </Text>
          <Text style={localStyles.listItem}>
            (b) Abusive of Others - Interfering with another individual's access to or use of the Services.
          </Text>
          <Text style={localStyles.listItem}>
            (c) Fraud - Activity which operates to deceive or defraud Ducat or any users.
          </Text>
          <Text style={localStyles.listItem}>
            (d) Abusive Activity - Activity that damages the reputation of Ducat or impairs our legal rights.
          </Text>
          <Text style={localStyles.listItem}>
            (e) Intellectual Property Infringement - Activity that violates the legal rights of others.
          </Text>

          <Text style={localStyles.sectionTitle}>8. CHANGES, SUSPENSION, & TERMINATION</Text>
          <Text style={localStyles.paragraph}>
            We may, at our sole discretion and without liability to you, with or without prior notice and at any time, modify or discontinue, temporarily or permanently, all or any part of the Services.
          </Text>

          <Text style={localStyles.sectionTitle}>9. INTELLECTUAL PROPERTY RIGHTS</Text>
          <Text style={localStyles.paragraph}>
            The Services and its entire contents, features, and functionality including but not limited to all information, software, text, displays, images, video, and audio, are owned by Ducat ("Ducat Materials"), its licensors, or other providers of such material and are protected by applicable copyright, trademark, patent, trade secret, and other intellectual property laws.
          </Text>

          <Text style={localStyles.sectionTitle}>16. WARRANTY DISCLAIMER</Text>
          <Text style={localStyles.paragraph}>
            THE SERVICES, DUCAT MATERIALS, THE PLATFORM, THE PROTOCOL, AND ANY PRODUCT, SERVICE OR OTHER ITEM PROVIDED BY OR ON BEHALF OF DUCAT ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. DUCAT MAKES NO REPRESENTATIONS OR WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
          </Text>

          <Text style={localStyles.sectionTitle}>17. INDEMNIFICATION</Text>
          <Text style={localStyles.paragraph}>
            You agree to defend, indemnify, and hold harmless Ducat, its affiliates, licensors, and service providers from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees arising out of or relating to your violation of these Terms or your use of the Services.
          </Text>

          <Text style={localStyles.sectionTitle}>18. LIMITATION OF LIABILITY</Text>
          <Text style={localStyles.paragraph}>
            TO THE FULLEST EXTENT PROVIDED BY LAW, IN NO EVENT WILL DUCAT BE LIABLE FOR DAMAGES OF ANY KIND, UNDER ANY LEGAL THEORY, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICES.
          </Text>

          <Text style={localStyles.sectionTitle}>19. DISPUTE RESOLUTION</Text>
          <Text style={localStyles.paragraph}>
            All Disputes between you and Ducat must be resolved by final and binding arbitration. By agreeing to binding arbitration, you and Ducat expressly waive the right to formal court proceedings including trial by jury and class action.
          </Text>

          <Text style={localStyles.sectionTitle}>20. GOVERNING LAW</Text>
          <Text style={localStyles.paragraph}>
            This Agreement shall be governed by, and construed and enforced in accordance with, the laws of the British Virgin Islands without regard to conflict of law rules or principles.
          </Text>

          <Text style={localStyles.sectionTitle}>21. AMENDMENTS</Text>
          <Text style={localStyles.paragraph}>
            We reserve the right to amend this Agreement at any time and in our sole discretion. Any amendment will be effective immediately and your continued use of the Services constitutes your agreement to be bound by all then-in-effect amendments.
          </Text>

          <Text style={localStyles.sectionTitle}>22. MISCELLANEOUS TERMS</Text>
          <Text style={localStyles.paragraph}>
            These Terms constitute the entire agreement and understanding between you and Ducat as to the subject matter hereof, and supersede any and all prior discussions, agreements, and understandings of any kind.
          </Text>

          <View style={localStyles.bottomPadding} />
        </View>
      </ScrollView>
    </ScreenLayout>
  );
});

export default TermsOfServiceScreen;

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 0,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    flex: 1,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'CabinetGrotesk-Regular',
    marginBottom: 20,
  },
  paragraph: {
    fontSize: 14,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
    lineHeight: 22,
    marginBottom: 16,
  },
  importantNotice: {
    fontSize: 12,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Medium',
    lineHeight: 18,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    marginTop: 24,
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Medium',
    marginTop: 16,
    marginBottom: 8,
  },
  listItem: {
    fontSize: 14,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 16,
  },
  bottomPadding: {
    height: 40,
  },
});
