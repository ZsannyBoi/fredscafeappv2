-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 31, 2025 at 12:09 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `espressolane_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `category_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`category_id`, `name`, `image_url`, `created_at`, `updated_at`) VALUES
(1, 'Coffee', '/uploads/image-1747815930920-660050420.png', '2025-05-21 07:00:00', '2025-05-21 08:25:30'),
(2, 'Pastries', '/uploads/image-1747815939632-950242448.png', '2025-05-21 07:05:00', '2025-05-21 08:25:39'),
(3, 'Sandwiches', '/uploads/image-1747815946090-215910128.png', '2025-05-21 07:10:00', '2025-05-21 08:25:46'),
(4, 'Beverages (Non-Coffee)', '/uploads/image-1747815957779-109349117.png', '2025-05-21 07:15:00', '2025-05-21 08:25:57'),
(5, 'Test', '/uploads/image-1748597858467-86221782.png', '2025-05-30 00:38:07', '2025-05-30 09:37:38');

-- --------------------------------------------------------

--
-- Table structure for table `customervouchers`
--

CREATE TABLE `customervouchers` (
  `voucher_instance_id` varchar(255) NOT NULL,
  `reward_id` varchar(255) NOT NULL,
  `user_id` int(11) NOT NULL,
  `name_snapshot` varchar(255) NOT NULL,
  `description_snapshot` text DEFAULT NULL,
  `granted_date` datetime DEFAULT current_timestamp(),
  `expiry_date` datetime DEFAULT NULL,
  `status` enum('active','claimed','expired') NOT NULL DEFAULT 'active',
  `granted_by_method` enum('system_earned','employee_granted','signup_bonus') NOT NULL,
  `employee_grant_user_id` int(11) DEFAULT NULL,
  `employee_grant_notes` text DEFAULT NULL,
  `claimed_date` timestamp NULL DEFAULT NULL,
  `order_id` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `customervouchers`
--

INSERT INTO `customervouchers` (`voucher_instance_id`, `reward_id`, `user_id`, `name_snapshot`, `description_snapshot`, `granted_date`, `expiry_date`, `status`, `granted_by_method`, `employee_grant_user_id`, `employee_grant_notes`, `claimed_date`, `order_id`) VALUES
('239473ab-fe0a-4234-9937-a5245e05bf37', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', 7, 'Coffee Add-on for Croissant', 'Pump up your croissant!', '2025-05-26 04:54:15', '2025-06-25 04:54:15', 'active', 'system_earned', NULL, NULL, NULL, NULL),
('2595d5c0-68d0-43aa-8dbe-11093df33c2b', 'ade4ffae-7248-41ba-8589-aeae57d95be7', 12, 'Face', 'test', '2025-05-30 18:01:32', '2025-06-29 18:01:32', 'active', 'system_earned', NULL, NULL, NULL, NULL),
('2a6d754c-abfb-41d6-b320-2b4167cfdc7e', 'ade4ffae-7248-41ba-8589-aeae57d95be7', 7, 'Face', 'test', '2025-05-30 17:50:56', '2025-06-29 17:50:56', 'active', 'system_earned', NULL, NULL, NULL, NULL),
('407932ad-4a8b-4de7-843e-77bd02073034', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', 9, 'Coffee Add-on for Croissant', 'Pump up your croissant!', '2025-05-30 13:23:08', '2025-06-29 13:23:08', 'active', 'employee_granted', 2, 'test', NULL, NULL),
('4f4dd244-a391-4ab5-98f1-f2d3f690a1cb', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', 10, 'Coffee Add-on for Croissant', 'Pump up your croissant!', '2025-05-28 11:45:54', '2025-06-27 11:45:54', '', 'system_earned', NULL, NULL, '2025-05-28 16:34:55', NULL),
('8b1eec67-f21e-460f-b5fc-5330cc7fe0dc', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', 1, 'Coffee Add-on for Croissant', 'Pump up your croissant!', '2025-05-21 22:10:05', '2025-06-20 22:10:05', 'active', 'system_earned', NULL, NULL, NULL, NULL),
('b9242b70-1d5a-4c28-a44d-e8f0b13bc44c', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', 9, 'Coffee Add-on for Croissant', 'Pump up your croissant!', '2025-05-28 10:27:46', '2025-06-27 10:27:46', 'active', 'system_earned', NULL, NULL, NULL, NULL),
('d3265ee5-49e3-4336-a468-4f8085864235', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', 8, 'Coffee Add-on for Croissant', 'Pump up your croissant!', '2025-05-22 14:19:32', '2025-06-21 14:19:32', 'active', 'system_earned', NULL, NULL, NULL, NULL),
('d53c3efe-f39d-49d3-b1c7-9cdd89587286', 'a4fc2305-9a0e-4e5b-8b3d-96fdf542d5d8', 7, 'January Reward', 'coool', '2025-05-26 15:23:37', '2025-06-25 15:23:37', 'active', 'employee_granted', 2, 'i love him', NULL, NULL),
('voucher_bruce_manual_001', 'reward_free_coffee', 6, 'Manual Free Coffee Grant', 'A special thank you for your feedback.', '2025-05-20 14:00:00', '2025-06-20 23:59:59', 'active', 'employee_granted', 1, 'Customer provided valuable feedback.', NULL, NULL),
('voucher_clark_discount_001', 'reward_10_percent_off', 5, '10% Off Your Next Order', 'Thank you for your loyalty, Clark! Enjoy 10% off your next purchase.', '2025-05-15 09:00:00', '2025-06-15 23:59:59', 'active', 'system_earned', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `customer_claimed_rewards`
--

CREATE TABLE `customer_claimed_rewards` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `reward_id` varchar(255) NOT NULL,
  `claimed_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `redeemed_date` datetime DEFAULT NULL,
  `order_id` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `customer_claimed_rewards`
--

INSERT INTO `customer_claimed_rewards` (`id`, `customer_id`, `reward_id`, `claimed_date`, `redeemed_date`, `order_id`) VALUES
(1, 4, 'reward_free_coffee', '2025-05-21 08:00:00', NULL, 'order_004'),
(2, 5, 'reward_10_percent_off', '2025-05-21 08:05:00', NULL, 'order_006'),
(3, 1, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', '2025-05-21 14:10:05', NULL, NULL),
(4, 1, 'reward_bogo_sandwich', '2025-05-21 14:10:08', NULL, NULL),
(5, 1, 'reward_free_coffee', '2025-05-21 14:27:33', NULL, NULL),
(7, 1, 'reward_10_percent_off', '2025-05-21 15:05:26', NULL, NULL),
(8, 4, 'reward_10_percent_off', '2025-05-22 04:43:58', NULL, NULL),
(9, 8, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', '2025-05-22 06:19:32', NULL, NULL),
(10, 7, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', '2025-05-25 20:54:15', NULL, NULL),
(11, 7, 'reward_free_coffee', '2025-05-26 06:14:43', NULL, NULL),
(12, 9, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', '2025-05-28 02:27:46', NULL, NULL),
(13, 10, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', '2025-05-28 03:45:54', NULL, NULL),
(17, 11, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', '2025-05-29 16:26:55', NULL, NULL),
(18, 5, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', '2025-05-29 17:03:20', NULL, NULL),
(24, 4, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', '2025-05-30 00:59:12', NULL, NULL),
(25, 9, 'ade4ffae-7248-41ba-8589-aeae57d95be7', '2025-05-30 01:13:34', NULL, NULL),
(26, 9, 'reward_free_coffee', '2025-05-30 05:51:56', NULL, NULL),
(27, 9, 'reward_bogo_sandwich', '2025-05-30 06:13:58', NULL, NULL),
(28, 7, 'ade4ffae-7248-41ba-8589-aeae57d95be7', '2025-05-30 09:50:56', NULL, NULL),
(29, 12, 'ade4ffae-7248-41ba-8589-aeae57d95be7', '2025-05-30 10:01:32', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `employeedetails`
--

CREATE TABLE `employeedetails` (
  `employee_internal_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `employee_id_code` varchar(50) NOT NULL,
  `position` varchar(100) NOT NULL,
  `status` enum('Active','Inactive','On Leave') NOT NULL DEFAULT 'Active',
  `hire_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `employeedetails`
--

INSERT INTO `employeedetails` (`employee_internal_id`, `user_id`, `employee_id_code`, `position`, `status`, `hire_date`, `created_at`, `updated_at`) VALUES
(1, 1, 'EMP001', 'Store Manager', 'Active', '2023-08-01', '2024-01-10 10:00:00', '2025-05-21 07:30:00'),
(2, 2, 'EMP002', 'Head Cashier', 'Active', '2023-09-15', '2024-02-01 09:00:00', '2025-05-21 07:30:00'),
(3, 3, 'EMP003', 'Lead Cook', 'Active', '2023-10-01', '2024-03-15 08:30:00', '2025-05-21 07:30:00'),
(4, 7, '65f4ca94a', 'Test Employee', 'Active', '2025-05-30', '2025-05-30 00:14:51', '2025-05-30 00:14:51');

-- --------------------------------------------------------

--
-- Table structure for table `loyalty_points_transactions`
--

CREATE TABLE `loyalty_points_transactions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `points` int(11) NOT NULL,
  `transaction_type` enum('earned','redeemed','expired','adjusted') NOT NULL,
  `order_id` varchar(255) DEFAULT NULL,
  `reward_id` varchar(255) DEFAULT NULL,
  `transaction_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `loyalty_points_transactions`
--

INSERT INTO `loyalty_points_transactions` (`id`, `user_id`, `points`, `transaction_type`, `order_id`, `reward_id`, `transaction_date`, `notes`) VALUES
(1, 4, 50, 'earned', 'order_001', NULL, '2025-05-21 08:00:00', 'Points from order #order_001'),
(2, 4, 100, 'earned', 'order_002', NULL, '2025-05-21 08:10:00', 'Points from order #order_002'),
(3, 4, -100, 'redeemed', NULL, 'reward_free_coffee', '2025-05-21 08:15:00', 'Redeemed for Free Medium Brewed Coffee'),
(4, 5, 45, 'earned', 'order_003', NULL, '2025-05-21 08:20:00', 'Points from order #order_003'),
(5, 6, 20, 'earned', 'order_007', NULL, '2025-05-21 08:25:00', 'Points from order #order_007'),
(6, 4, 50, 'earned', 'order_004', NULL, '2025-05-21 08:30:00', 'Points from order #order_004'),
(7, 1, -200, 'redeemed', NULL, 'reward_bogo_sandwich', '2025-05-21 14:10:08', 'Redeemed for Buy One Get One Sandwich'),
(8, 1, -100, 'redeemed', NULL, 'reward_free_coffee', '2025-05-21 14:27:33', 'Redeemed for Free Medium Brewed Coffee'),
(9, 1, -150, 'redeemed', NULL, 'reward_10_percent_off', '2025-05-21 15:05:26', 'Redeemed for 10% Off Your Next Order'),
(10, 4, -150, 'redeemed', NULL, 'reward_10_percent_off', '2025-05-22 04:43:58', 'Redeemed for 10% Off Your Next Order'),
(11, 7, -100, 'redeemed', NULL, 'reward_free_coffee', '2025-05-26 06:14:43', 'Redeemed for Free Medium Brewed Coffee');

-- --------------------------------------------------------

--
-- Table structure for table `membershiptransactions`
--

CREATE TABLE `membershiptransactions` (
  `transaction_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `tier` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `transaction_date` datetime NOT NULL,
  `status` enum('pending','active','cancelled','expired','rejected') NOT NULL DEFAULT 'pending',
  `end_date` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `membershiptransactions`
--

INSERT INTO `membershiptransactions` (`transaction_id`, `user_id`, `tier`, `amount`, `transaction_date`, `status`, `end_date`, `created_at`, `updated_at`) VALUES
(5, 7, 'bronze', 4.99, '2025-05-30 21:24:03', 'active', '2025-06-30 21:24:03', '2025-05-30 13:24:03', '2025-05-30 13:24:03'),
(6, 9, 'bronze', 4.99, '2025-05-30 21:35:24', 'cancelled', '2025-06-30 21:35:24', '2025-05-30 13:35:24', '2025-05-30 13:35:27'),
(28, 1, 'gold', 19.99, '2025-05-31 02:03:07', 'cancelled', '2025-07-01 02:03:07', '2025-05-30 18:03:07', '2025-05-30 18:03:53'),
(29, 1, 'silver', 9.99, '2025-05-31 02:08:35', 'cancelled', '2025-07-01 02:08:35', '2025-05-30 18:08:35', '2025-05-30 18:08:50'),
(49, 9, 'silver', 9.99, '2025-05-31 17:21:39', 'cancelled', '2025-07-01 17:21:39', '2025-05-31 09:21:39', '2025-05-31 09:21:51'),
(50, 9, 'silver', 9.99, '2025-05-31 17:21:56', 'rejected', '2025-07-01 17:21:56', '2025-05-31 09:21:56', '2025-05-31 09:21:59'),
(51, 9, 'silver', 9.99, '2025-05-31 18:08:04', 'rejected', '2025-07-01 18:08:04', '2025-05-31 10:08:04', '2025-05-31 10:08:07'),
(52, 9, 'silver', 9.99, '2025-05-31 18:08:16', 'cancelled', '2025-07-01 18:08:16', '2025-05-31 10:08:16', '2025-05-31 10:08:23'),
(53, 9, 'bronze', 4.99, '2025-05-31 18:08:32', 'cancelled', '2025-07-01 18:08:32', '2025-05-31 10:08:32', '2025-05-31 10:08:38');

-- --------------------------------------------------------

--
-- Table structure for table `optiongroups`
--

CREATE TABLE `optiongroups` (
  `option_group_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `selection_type` enum('radio','checkbox') NOT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `optiongroups`
--

INSERT INTO `optiongroups` (`option_group_id`, `name`, `selection_type`, `is_required`) VALUES
(1, 'Coffee Size', 'radio', 1),
(2, 'Milk Type', 'radio', 0),
(3, 'Add-ons', 'checkbox', 0);

-- --------------------------------------------------------

--
-- Table structure for table `options`
--

CREATE TABLE `options` (
  `option_id` int(11) NOT NULL,
  `option_group_id` int(11) NOT NULL,
  `label` varchar(100) NOT NULL,
  `price_modifier` decimal(6,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `options`
--

INSERT INTO `options` (`option_id`, `option_group_id`, `label`, `price_modifier`) VALUES
(1, 1, 'Small', -0.50),
(2, 1, 'Medium', 0.00),
(3, 1, 'Large', 0.75),
(4, 2, 'Whole Milk', 0.00),
(5, 2, 'Skim Milk', 0.00),
(6, 2, 'Almond Milk', 0.50),
(7, 3, 'Extra Shot', 1.00),
(8, 3, 'Whipped Cream', 0.75);

-- --------------------------------------------------------

--
-- Table structure for table `orderlineitems`
--

CREATE TABLE `orderlineitems` (
  `order_line_item_id` int(11) NOT NULL,
  `order_id` varchar(255) NOT NULL,
  `product_id` varchar(255) NOT NULL,
  `product_name_snapshot` varchar(150) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price_snapshot` decimal(8,2) NOT NULL,
  `total_line_price` decimal(10,2) NOT NULL,
  `is_reward_item` tinyint(1) DEFAULT 0,
  `reward_id` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orderlineitems`
--

INSERT INTO `orderlineitems` (`order_line_item_id`, `order_id`, `product_id`, `product_name_snapshot`, `quantity`, `unit_price_snapshot`, `total_line_price`, `is_reward_item`, `reward_id`) VALUES
(1, 'order_001', 'prod_latte', 'Cafe Latte', 1, 4.00, 4.00, 0, NULL),
(2, 'order_001', 'prod_croissant', 'Butter Croissant', 1, 2.50, 2.50, 0, NULL),
(3, 'order_002', 'prod_cappuccino', 'Cappuccino', 2, 4.00, 8.00, 0, NULL),
(4, 'order_003', 'prod_espresso', 'Espresso', 1, 2.50, 2.50, 0, NULL),
(5, 'order_003', 'prod_iced_tea', 'Iced Tea (Lemon)', 1, 3.50, 3.50, 0, NULL),
(6, 'order_004', 'prod_latte', 'Cafe Latte', 1, 4.00, 4.00, 0, NULL),
(7, 'order_004', 'prod_espresso', 'Espresso', 1, 2.50, 2.50, 1, 'reward_free_coffee'),
(8, 'order_005', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(9, 'order_005', 'prod_croissant', 'Butter Croissant', 1, 2.00, 2.00, 0, NULL),
(11, 'order_006', 'prod_latte', 'Cafe Latte', 2, 4.00, 8.00, 0, NULL),
(12, 'order_006', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(13, 'order_006', 'prod_iced_tea', 'Iced Tea (Lemon)', 2, 3.50, 7.00, 0, NULL),
(14, 'order_007', 'prod_cappuccino', 'Cappuccino', 2, 4.25, 8.50, 0, NULL),
(15, 'order_007', 'prod_croissant', 'Butter Croissant', 1, 3.00, 3.00, 0, NULL),
(18, '3c71fc17-fee1-403c-9fab-28465d65100a', 'prod_latte', 'Cafe Latte (Free with Reward)', 1, 0.00, 0.00, 1, 'reward_bogo_sandwich'),
(19, '3c71fc17-fee1-403c-9fab-28465d65100a', 'prod_chicken_sandwich', 'Chicken Club Sandwich (Free with Reward)', 1, 0.00, 0.00, 1, 'reward_bogo_sandwich'),
(20, '3c71fc17-fee1-403c-9fab-28465d65100a', 'prod_latte', 'Cafe Latte', 4, 4.50, 18.00, 0, NULL),
(21, '3c71fc17-fee1-403c-9fab-28465d65100a', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 6, 8.50, 51.00, 0, NULL),
(22, '44942e93-37c4-4947-a0d6-e814c2ee1fc5', 'prod_latte', 'Cafe Latte (Free with Reward)', 1, 0.00, 0.00, 1, 'reward_bogo_sandwich'),
(23, '44942e93-37c4-4947-a0d6-e814c2ee1fc5', 'prod_chicken_sandwich', 'Chicken Club Sandwich (Free with Reward)', 1, 0.00, 0.00, 1, 'reward_bogo_sandwich'),
(24, '472702ce-ebc6-4e96-ab7f-4dad161e3b36', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(25, 'af0218e1-0b1f-493f-abff-c511232f19df', 'prod_cappuccino', 'Cappuccino', 1, 5.00, 5.00, 0, NULL),
(26, '46ede522-0a0a-40aa-ab8f-beb08cdd7359', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(27, 'c066f38c-68d8-43f3-8ee4-6a5fa89bf405', 'prod_latte', 'Cafe Latte', 1, 4.75, 4.75, 0, NULL),
(28, 'c066f38c-68d8-43f3-8ee4-6a5fa89bf405', 'prod_croissant', 'Butter Croissant', 1, 3.00, 3.00, 0, NULL),
(29, 'ea9185d8-2a43-4132-9346-0d3d32b0cdf2', 'prod_cappuccino', 'Cappuccino', 11, 5.00, 55.00, 0, NULL),
(30, 'd65b851e-3be5-40a3-a9b4-b18b2a8b85f0', 'prod_latte', 'Cafe Latte', 1, 4.75, 4.75, 0, NULL),
(31, 'de516e99-95e8-4a11-a2f6-481ccb72845c', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 0.00, 0.00, 1, 'reward_bogo_sandwich'),
(32, 'de516e99-95e8-4a11-a2f6-481ccb72845c', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'reward_bogo_sandwich'),
(33, 'd42babe5-0c9d-4969-a1b1-b0e0c10bd534', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 0.00, 0.00, 1, 'reward_bogo_sandwich'),
(34, 'd42babe5-0c9d-4969-a1b1-b0e0c10bd534', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'reward_bogo_sandwich'),
(35, '4b5b111a-7e69-42fe-83ac-de7d5f283aa5', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(36, '22370862-450b-42db-bd1c-9e2f9381afd5', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(37, 'e0255e7f-a6ca-4625-8203-a14b77e7f32d', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa'),
(38, '20b0d9c2-305f-4422-b596-9abd98494432', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa'),
(39, '71d1334d-70b1-4dd6-8e7b-613812e332bb', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa'),
(42, '9c0626b5-a936-4dc8-8a9f-2714f77b0d6c', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(43, 'f942945e-6df4-41ef-a56b-3852581cf700', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(44, '161bf78b-9dae-4739-834d-3dd1365944cc', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(45, '5e16d21f-9a76-4bc8-a003-1fb31d51046e', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa'),
(46, '5e16d21f-9a76-4bc8-a003-1fb31d51046e', 'prod_espresso', 'Espresso', 1, 0.00, 0.00, 1, 'reward_free_coffee'),
(47, '5e16d21f-9a76-4bc8-a003-1fb31d51046e', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(48, 'ca5e97d3-792c-4ae2-8bf1-cd79c11e07fe', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa'),
(49, 'ca5e97d3-792c-4ae2-8bf1-cd79c11e07fe', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(50, '4255faa6-026c-4044-9548-ddf19ee62a0b', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa'),
(51, '0a1a0a9c-40da-4671-bf8e-025b72c09273', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 3, 8.50, 25.50, 0, NULL),
(52, '64e81756-6a4e-4246-8a8d-87ecae467952', 'prod_cappuccino', 'Cappuccino', 2, 3.75, 7.50, 0, NULL),
(53, '8543a8ec-f30c-415b-b7c1-0651f4be66ec', 'prod_cappuccino', 'Cappuccino', 2, 3.75, 7.50, 0, NULL),
(54, '6fa724af-9119-4e54-a809-f78d81182878', 'prod_cappuccino', 'Cappuccino', 1, 5.25, 5.25, 0, NULL),
(55, '357b9fcb-7e1f-4b3e-a2d9-19177f878749', 'prod_espresso', 'Espresso', 1, 0.00, 0.00, 1, 'reward_free_coffee'),
(56, '357b9fcb-7e1f-4b3e-a2d9-19177f878749', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(57, '60961c1f-efef-4c21-a08c-a9edc6597770', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa'),
(64, 'ORD1748450095978901', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa'),
(65, 'ORD1748450095978901', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(67, 'ORD1748453999712170', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(68, 'c4ef5d71-50fd-43d1-bc8b-b59ec9ea4378', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(71, 'fea5e0e7-21d4-40d1-912e-5b07bfd1e5b2', 'prod_croissant', 'Butter Croissant', 1, 0.00, 0.00, 1, 'ade4ffae-7248-41ba-8589-aeae57d95be7'),
(72, 'fea5e0e7-21d4-40d1-912e-5b07bfd1e5b2', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(73, 'a6e2c83b-13ee-406d-a497-67f42432b712', 'prod_croissant', 'Butter Croissant', 1, 0.00, 0.00, 1, 'ade4ffae-7248-41ba-8589-aeae57d95be7'),
(74, 'a6e2c83b-13ee-406d-a497-67f42432b712', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(75, '618e5568-1cac-436a-b3bb-520656e69ab8', 'prod_croissant', 'Butter Croissant', 1, 0.00, 0.00, 1, 'ade4ffae-7248-41ba-8589-aeae57d95be7'),
(76, '2012bdd6-d79f-4b12-9ce6-be80f67b7877', 'prod_croissant', 'Butter Croissant', 1, 0.00, 0.00, 1, 'ade4ffae-7248-41ba-8589-aeae57d95be7'),
(77, '1b779d21-cd56-472b-86fd-2c80145bd545', 'prod_croissant', 'Butter Croissant', 1, 0.00, 0.00, 1, 'ade4ffae-7248-41ba-8589-aeae57d95be7'),
(78, 'b13ee6de-3802-4d47-8495-f08992c25897', 'prod_croissant', 'Butter Croissant', 1, 0.00, 0.00, 1, 'ade4ffae-7248-41ba-8589-aeae57d95be7'),
(79, '597a69d8-d864-44ae-9da4-ec5011d43c54', 'prod_croissant', 'Butter Croissant', 1, 0.00, 0.00, 1, 'ade4ffae-7248-41ba-8589-aeae57d95be7'),
(80, 'b77c1da7-f87e-4411-bcd7-884119ada0ee', 'prod_croissant', 'Butter Croissant', 1, 0.00, 0.00, 1, 'ade4ffae-7248-41ba-8589-aeae57d95be7'),
(81, 'ec271ad3-549b-42b0-b563-b4e752d5f024', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa'),
(82, '39ddff3b-a20f-490e-8cd1-6ab1f78f61d9', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa'),
(83, '0e7bbc63-b1cc-4082-9307-5d7b6d755201', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 0.00, 0.00, 1, 'reward_bogo_sandwich'),
(84, '0e7bbc63-b1cc-4082-9307-5d7b6d755201', 'prod_latte', 'Cafe Latte', 1, 0.00, 0.00, 1, 'reward_bogo_sandwich'),
(85, 'dc88b08d-d742-4119-b2bb-890ab639cd1b', 'prod_croissant', 'Butter Croissant', 1, 0.00, 0.00, 1, 'ade4ffae-7248-41ba-8589-aeae57d95be7'),
(86, '975ee8e5-d9cb-4b1f-b0d2-cc2631b72bb7', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL),
(87, '6b29757f-8116-464c-b744-fc469944050e', 'prod_cappuccino', 'Cappuccino', 1, 4.25, 4.25, 0, NULL),
(88, '8c7a27c7-05df-44df-bdd6-38214aaa2447', 'prod_chicken_sandwich', 'Chicken Club Sandwich', 1, 8.50, 8.50, 0, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `orderlineitem_selectedoptions`
--

CREATE TABLE `orderlineitem_selectedoptions` (
  `order_line_item_id` int(11) NOT NULL,
  `option_id` int(11) NOT NULL,
  `selected_option_label_snapshot` varchar(100) NOT NULL,
  `price_modifier_snapshot` decimal(6,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orderlineitem_selectedoptions`
--

INSERT INTO `orderlineitem_selectedoptions` (`order_line_item_id`, `option_id`, `selected_option_label_snapshot`, `price_modifier_snapshot`) VALUES
(1, 2, 'Medium', 0.00),
(1, 4, 'Whole Milk', 0.00),
(3, 2, 'Medium', 0.00),
(3, 5, 'Skim Milk', 0.00),
(4, 1, 'Small', -0.50),
(6, 2, 'Medium', 0.00),
(6, 6, 'Almond Milk', 0.50),
(7, 2, 'Medium', 0.00),
(11, 3, 'Large', 0.75),
(11, 4, 'Whole Milk', 0.00),
(14, 2, 'Medium', 0.00),
(14, 7, 'Extra Shot', 1.00),
(18, 1, 'Small', -0.50),
(18, 4, 'Whole Milk', 0.00),
(20, 2, 'Medium', 0.00),
(20, 6, 'Almond Milk', 0.50),
(22, 1, 'Small', -0.50),
(22, 4, 'Whole Milk', 0.00),
(25, 3, 'Large', 0.75),
(27, 3, 'Large', 0.75),
(29, 3, 'Large', 0.75),
(30, 3, 'Large', 0.75),
(30, 5, 'Skim Milk', 0.00),
(52, 1, 'Small', -0.50),
(53, 1, 'Small', -0.50),
(54, 1, 'Small', -0.50),
(54, 6, 'Almond Milk', 0.50),
(54, 7, 'Extra Shot', 1.00),
(87, 2, 'Medium', 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `order_id` varchar(255) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `customer_name_snapshot` varchar(150) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `status` enum('pending','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'pending',
  `ticket_number` varchar(50) NOT NULL,
  `is_archived` tinyint(1) NOT NULL DEFAULT 0,
  `order_timestamp` datetime DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `original_amount` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`order_id`, `customer_id`, `customer_name_snapshot`, `total_amount`, `status`, `ticket_number`, `is_archived`, `order_timestamp`, `created_at`, `updated_at`, `discount_amount`, `original_amount`) VALUES
('0a1a0a9c-40da-4671-bf8e-025b72c09273', 7, 'Rick Morty', 25.50, 'completed', '5901', 0, '2025-05-26 22:24:57', '2025-05-26 14:24:57', '2025-05-26 16:55:16', 0.00, 25.50),
('0e7bbc63-b1cc-4082-9307-5d7b6d755201', 9, 'Test User', 0.00, 'pending', '4678', 0, '2025-05-30 17:52:30', '2025-05-30 09:52:30', '2025-05-30 09:52:30', 0.00, 0.00),
('161bf78b-9dae-4739-834d-3dd1365944cc', 7, 'Rick Morty', 7.65, 'completed', '2299', 0, '2025-05-26 16:34:43', '2025-05-26 08:34:43', '2025-05-29 15:53:05', 0.85, 8.50),
('1b779d21-cd56-472b-86fd-2c80145bd545', 9, 'Test User', 0.00, 'pending', '2242', 0, '2025-05-30 17:25:24', '2025-05-30 09:25:24', '2025-05-30 09:25:24', 0.00, 0.00),
('2012bdd6-d79f-4b12-9ce6-be80f67b7877', 9, 'Test User', 0.00, 'pending', '8527', 0, '2025-05-30 14:32:50', '2025-05-30 06:32:50', '2025-05-30 06:32:50', 0.00, 0.00),
('20b0d9c2-305f-4422-b596-9abd98494432', 7, 'Rick Morty', 0.00, 'pending', '9223', 0, '2025-05-26 15:53:20', '2025-05-26 07:53:20', '2025-05-26 16:55:27', 0.00, 0.00),
('22370862-450b-42db-bd1c-9e2f9381afd5', 7, 'Rick Morty', 7.65, 'pending', '4640', 0, '2025-05-26 15:52:34', '2025-05-26 07:52:34', '2025-05-26 16:55:29', 0.85, 8.50),
('357b9fcb-7e1f-4b3e-a2d9-19177f878749', 7, 'Rick Morty', 8.50, 'completed', '8257', 0, '2025-05-27 15:15:52', '2025-05-27 07:15:52', '2025-05-27 07:41:38', 0.00, 8.50),
('39ddff3b-a20f-490e-8cd1-6ab1f78f61d9', 7, 'Rick Morty', 0.00, 'pending', '6321', 0, '2025-05-30 17:51:47', '2025-05-30 09:51:47', '2025-05-30 09:51:47', 0.00, 0.00),
('3c71fc17-fee1-403c-9fab-28465d65100a', 1, 'Alice Smith', 69.00, 'completed', '6297', 0, '2025-05-21 23:15:16', '2025-05-21 15:15:16', '2025-05-27 07:33:47', 0.00, 69.00),
('4255faa6-026c-4044-9548-ddf19ee62a0b', 7, 'Rick Morty', 0.00, 'completed', '1571', 0, '2025-05-26 21:39:56', '2025-05-26 13:39:56', '2025-05-26 16:55:37', 0.00, 0.00),
('44942e93-37c4-4947-a0d6-e814c2ee1fc5', 7, 'Charlie Brown', 0.00, 'pending', '3607', 0, '2025-05-22 02:39:44', '2025-05-21 18:39:44', '2025-05-26 16:55:39', 0.00, 0.00),
('46ede522-0a0a-40aa-ab8f-beb08cdd7359', 7, 'Bob Johnson', 8.50, 'cancelled', '8916', 0, '2025-05-22 10:44:28', '2025-05-22 02:44:28', '2025-05-26 16:55:47', 0.00, 8.50),
('472702ce-ebc6-4e96-ab7f-4dad161e3b36', NULL, 'Bob Johnson', 8.50, 'ready', '3180', 0, '2025-05-22 10:14:32', '2025-05-22 02:14:32', '2025-05-28 16:51:12', 0.00, 8.50),
('4b5b111a-7e69-42fe-83ac-de7d5f283aa5', 7, 'Rick Morty', 7.65, 'pending', '5760', 0, '2025-05-26 15:26:27', '2025-05-26 07:26:27', '2025-05-26 16:56:17', 0.85, 8.50),
('597a69d8-d864-44ae-9da4-ec5011d43c54', 9, 'Test User', 0.00, 'pending', '6930', 0, '2025-05-30 17:34:58', '2025-05-30 09:34:58', '2025-05-30 09:34:58', 0.00, 0.00),
('5e16d21f-9a76-4bc8-a003-1fb31d51046e', 7, 'Rick Morty', 7.65, 'completed', '1725', 0, '2025-05-26 16:34:59', '2025-05-26 08:34:59', '2025-05-29 15:53:02', 0.85, 8.50),
('60961c1f-efef-4c21-a08c-a9edc6597770', 9, 'Test User', 0.00, 'preparing', '5483', 0, '2025-05-28 10:28:14', '2025-05-28 02:28:14', '2025-05-29 15:52:58', 0.00, 0.00),
('618e5568-1cac-436a-b3bb-520656e69ab8', 9, 'Test User', 0.00, 'pending', '2753', 0, '2025-05-30 14:32:24', '2025-05-30 06:32:24', '2025-05-30 06:32:24', 0.00, 0.00),
('64e81756-6a4e-4246-8a8d-87ecae467952', 1, 'Alice Smith', 7.50, 'pending', '1420', 0, '2025-05-26 22:26:24', '2025-05-26 14:26:24', '2025-05-26 16:56:53', 0.00, 7.50),
('6b29757f-8116-464c-b744-fc469944050e', 9, 'Test User', 4.25, 'pending', '3079', 0, '2025-05-31 17:05:32', '2025-05-31 09:05:32', '2025-05-31 09:05:32', 0.00, 4.25),
('6fa724af-9119-4e54-a809-f78d81182878', 7, 'Rick Morty', 5.25, 'pending', '2089', 0, '2025-05-27 07:33:21', '2025-05-26 23:33:21', '2025-05-26 23:33:21', 0.00, 5.25),
('71d1334d-70b1-4dd6-8e7b-613812e332bb', 7, 'Rick Morty', 0.00, 'pending', '3368', 0, '2025-05-26 15:59:17', '2025-05-26 07:59:17', '2025-05-26 16:56:23', 0.00, 0.00),
('8543a8ec-f30c-415b-b7c1-0651f4be66ec', 7, 'Rick Morty', 7.50, 'completed', '9595', 0, '2025-05-26 23:43:45', '2025-05-26 15:43:45', '2025-05-27 07:33:44', 0.00, 7.50),
('8c7a27c7-05df-44df-bdd6-38214aaa2447', 9, 'Test User', 8.50, 'pending', '8701', 0, '2025-05-31 17:05:38', '2025-05-31 09:05:38', '2025-05-31 09:05:38', 0.00, 8.50),
('975ee8e5-d9cb-4b1f-b0d2-cc2631b72bb7', 9, 'Test User', 8.50, 'pending', '7491', 0, '2025-05-31 15:00:53', '2025-05-31 07:00:53', '2025-05-31 07:00:53', 0.00, 8.50),
('9c0626b5-a936-4dc8-8a9f-2714f77b0d6c', 7, 'Rick Morty', 7.65, 'pending', '6456', 0, '2025-05-26 16:09:22', '2025-05-26 08:09:22', '2025-05-26 16:56:25', 0.85, 8.50),
('a6e2c83b-13ee-406d-a497-67f42432b712', 9, 'Test User', 8.50, 'pending', '6718', 0, '2025-05-30 14:08:38', '2025-05-30 06:08:38', '2025-05-30 06:08:38', 0.00, 8.50),
('a7d01216-0ef1-4e1f-8372-8c1f9138c0ce', 9, 'Test User', 0.00, 'preparing', '8429', 0, '2025-05-29 23:49:18', '2025-05-29 15:49:18', '2025-05-29 15:52:52', 0.00, 0.00),
('af0218e1-0b1f-493f-abff-c511232f19df', NULL, 'Bob Johnson', 5.00, 'pending', '7035', 0, '2025-05-22 10:21:36', '2025-05-22 02:21:36', '2025-05-22 02:21:36', 0.00, 5.00),
('b13ee6de-3802-4d47-8495-f08992c25897', 9, 'Test User', 0.00, 'pending', '1186', 0, '2025-05-30 17:33:17', '2025-05-30 09:33:17', '2025-05-30 09:33:17', 0.00, 0.00),
('b77c1da7-f87e-4411-bcd7-884119ada0ee', 7, 'Rick Morty', 0.00, 'pending', '6354', 0, '2025-05-30 17:51:14', '2025-05-30 09:51:14', '2025-05-30 09:51:14', 0.00, 0.00),
('c066f38c-68d8-43f3-8ee4-6a5fa89bf405', NULL, 'qwerty', 7.75, 'completed', '8660', 0, '2025-05-22 14:17:02', '2025-05-22 06:17:02', '2025-05-22 06:17:26', 0.00, 7.75),
('c4ef5d71-50fd-43d1-bc8b-b59ec9ea4378', 9, 'Test User', 8.50, 'preparing', '9929', 0, '2025-05-29 21:41:48', '2025-05-29 13:41:48', '2025-05-29 15:52:53', 0.00, 8.50),
('ca5e97d3-792c-4ae2-8bf1-cd79c11e07fe', 7, 'Rick Morty', 7.65, 'completed', '2184', 0, '2025-05-26 21:39:36', '2025-05-26 13:39:36', '2025-05-26 16:56:30', 0.85, 8.50),
('d42babe5-0c9d-4969-a1b1-b0e0c10bd534', 7, 'Rick Morty', 0.00, 'pending', '6535', 0, '2025-05-26 13:21:07', '2025-05-26 05:21:07', '2025-05-26 16:56:33', 0.00, 0.00),
('d65b851e-3be5-40a3-a9b4-b18b2a8b85f0', 1, 'Alice Smith', 4.75, 'ready', '3610', 0, '2025-05-26 03:05:50', '2025-05-25 19:05:50', '2025-05-28 16:51:15', 0.00, 4.75),
('dc88b08d-d742-4119-b2bb-890ab639cd1b', 12, 'Buy One Get One Sandwich', 0.00, 'pending', '9040', 0, '2025-05-30 18:01:37', '2025-05-30 10:01:37', '2025-05-30 10:01:37', 0.00, 0.00),
('de516e99-95e8-4a11-a2f6-481ccb72845c', 7, 'Rick Morty', 0.00, 'completed', '8672', 0, '2025-05-26 12:22:52', '2025-05-26 04:22:52', '2025-05-30 00:26:56', 0.00, 0.00),
('e0255e7f-a6ca-4625-8203-a14b77e7f32d', 7, 'Rick Morty', 0.00, 'pending', '1160', 0, '2025-05-26 15:52:56', '2025-05-26 07:52:56', '2025-05-26 16:56:35', 0.00, 0.00),
('ea9185d8-2a43-4132-9346-0d3d32b0cdf2', 1, 'Alice Smith', 55.00, 'pending', '6428', 0, '2025-05-22 14:30:52', '2025-05-22 06:30:52', '2025-05-26 16:56:40', 0.00, 55.00),
('ec271ad3-549b-42b0-b563-b4e752d5f024', 7, 'Rick Morty', 0.00, 'pending', '8645', 0, '2025-05-30 17:51:27', '2025-05-30 09:51:27', '2025-05-30 09:51:27', 0.00, 0.00),
('f942945e-6df4-41ef-a56b-3852581cf700', 7, 'Rick Morty', 7.65, 'completed', '5372', 0, '2025-05-26 16:09:34', '2025-05-26 08:09:34', '2025-05-27 07:33:46', 0.85, 8.50),
('fea5e0e7-21d4-40d1-912e-5b07bfd1e5b2', 9, 'Test User', 8.50, 'pending', '3657', 0, '2025-05-30 09:13:47', '2025-05-30 01:13:47', '2025-05-30 01:13:47', 0.00, 8.50),
('ORD1748450095978901', 10, 'Test2 User', 8.50, 'preparing', 'T001', 0, '2025-05-29 00:34:55', '2025-05-28 16:34:55', '2025-05-29 15:52:55', 0.00, 8.50),
('ORD1748453999712170', 9, 'Test User', 8.50, 'preparing', 'T002', 0, '2025-05-29 01:39:59', '2025-05-28 17:39:59', '2025-05-29 15:52:54', 0.00, 8.50),
('order_001', 4, 'Diana Prince', 6.50, 'completed', '#1001', 1, '2025-05-20 09:30:00', '2025-05-20 09:30:00', '2025-05-27 07:34:01', 0.00, 6.50),
('order_002', 4, 'Diana Prince', 8.00, 'completed', '#1002', 1, '2025-05-20 10:00:00', '2025-05-20 10:00:00', '2025-05-27 07:34:09', 0.00, 8.00),
('order_003', 5, 'Clark Kent', 4.75, 'completed', '#1003', 1, '2025-05-20 11:00:00', '2025-05-20 11:00:00', '2025-05-27 07:34:11', 0.00, 4.75),
('order_004', 4, 'Diana Prince', 4.00, 'completed', '#1004', 1, '2025-05-21 08:16:00', '2025-05-21 08:16:00', '2025-05-27 07:34:13', 4.00, 4.00),
('order_005', 4, 'Diana Prince', 7.50, 'completed', '#1005', 1, '2025-01-15 10:30:00', '2025-01-15 10:30:00', '2025-05-27 07:34:07', 3.00, 10.50),
('order_006', 5, 'Clark Kent', 22.50, 'completed', '#1006', 1, '2025-05-21 09:00:00', '2025-05-21 09:00:00', '2025-05-27 07:34:15', 2.50, 25.00),
('order_007', 6, 'Bruce Wayne', 9.00, 'completed', '#1007', 0, '2025-05-21 09:30:00', '2025-05-21 09:30:00', '2025-05-27 07:34:29', 0.00, 9.00);

-- --------------------------------------------------------

--
-- Table structure for table `order_rewards`
--

CREATE TABLE `order_rewards` (
  `id` int(11) NOT NULL,
  `order_id` varchar(255) NOT NULL,
  `reward_id` varchar(255) NOT NULL,
  `voucher_id` varchar(255) DEFAULT NULL,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `free_items_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`free_items_json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_rewards`
--

INSERT INTO `order_rewards` (`id`, `order_id`, `reward_id`, `voucher_id`, `discount_amount`, `free_items_json`) VALUES
(1, 'order_004', 'reward_free_coffee', NULL, 0.00, '[{\"product_id\": \"prod_espresso\", \"quantity\": 1, \"product_name_snapshot\": \"Espresso\"}]'),
(3, 'order_006', 'reward_10_percent_off', 'voucher_clark_discount_001', 2.50, NULL),
(4, 'c066f38c-68d8-43f3-8ee4-6a5fa89bf405', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', NULL, 0.00, '[\"prod_latte\"]'),
(5, 'de516e99-95e8-4a11-a2f6-481ccb72845c', 'reward_bogo_sandwich', NULL, 0.00, '[\"prod_chicken_sandwich\",\"prod_latte\"]'),
(6, 'd42babe5-0c9d-4969-a1b1-b0e0c10bd534', 'reward_bogo_sandwich', NULL, 0.00, '[\"prod_chicken_sandwich\",\"prod_latte\"]'),
(7, '4b5b111a-7e69-42fe-83ac-de7d5f283aa5', 'a4fc2305-9a0e-4e5b-8b3d-96fdf542d5d8', 'd53c3efe-f39d-49d3-b1c7-9cdd89587286', 0.85, NULL),
(8, '22370862-450b-42db-bd1c-9e2f9381afd5', 'a4fc2305-9a0e-4e5b-8b3d-96fdf542d5d8', 'd53c3efe-f39d-49d3-b1c7-9cdd89587286', 0.85, NULL),
(9, 'e0255e7f-a6ca-4625-8203-a14b77e7f32d', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', NULL, 0.00, '[\"prod_latte\"]'),
(10, '20b0d9c2-305f-4422-b596-9abd98494432', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', NULL, 0.00, '[\"prod_latte\"]'),
(11, '71d1334d-70b1-4dd6-8e7b-613812e332bb', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', NULL, 0.00, '[\"prod_latte\"]'),
(12, '9c0626b5-a936-4dc8-8a9f-2714f77b0d6c', 'a4fc2305-9a0e-4e5b-8b3d-96fdf542d5d8', 'd53c3efe-f39d-49d3-b1c7-9cdd89587286', 0.85, NULL),
(13, 'f942945e-6df4-41ef-a56b-3852581cf700', 'a4fc2305-9a0e-4e5b-8b3d-96fdf542d5d8', 'd53c3efe-f39d-49d3-b1c7-9cdd89587286', 0.85, NULL),
(14, '161bf78b-9dae-4739-834d-3dd1365944cc', 'a4fc2305-9a0e-4e5b-8b3d-96fdf542d5d8', 'd53c3efe-f39d-49d3-b1c7-9cdd89587286', 0.85, NULL),
(15, '5e16d21f-9a76-4bc8-a003-1fb31d51046e', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', '239473ab-fe0a-4234-9937-a5245e05bf37', 0.00, '[\"prod_latte\"]'),
(16, '5e16d21f-9a76-4bc8-a003-1fb31d51046e', 'a4fc2305-9a0e-4e5b-8b3d-96fdf542d5d8', 'd53c3efe-f39d-49d3-b1c7-9cdd89587286', 0.85, NULL),
(17, '5e16d21f-9a76-4bc8-a003-1fb31d51046e', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', NULL, 0.00, '[\"prod_latte\"]'),
(18, '5e16d21f-9a76-4bc8-a003-1fb31d51046e', 'reward_free_coffee', NULL, 0.00, '[\"prod_espresso\"]'),
(19, 'ca5e97d3-792c-4ae2-8bf1-cd79c11e07fe', 'a4fc2305-9a0e-4e5b-8b3d-96fdf542d5d8', 'd53c3efe-f39d-49d3-b1c7-9cdd89587286', 0.85, NULL),
(20, 'ca5e97d3-792c-4ae2-8bf1-cd79c11e07fe', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', NULL, 0.00, '[\"prod_latte\"]'),
(21, '4255faa6-026c-4044-9548-ddf19ee62a0b', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', '239473ab-fe0a-4234-9937-a5245e05bf37', 0.00, '[\"prod_latte\"]'),
(22, '357b9fcb-7e1f-4b3e-a2d9-19177f878749', 'reward_free_coffee', NULL, 0.00, '[\"prod_espresso\"]'),
(23, '60961c1f-efef-4c21-a08c-a9edc6597770', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', 'b9242b70-1d5a-4c28-a44d-e8f0b13bc44c', 0.00, '[\"prod_latte\"]'),
(25, 'ORD1748450095978901', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', '4f4dd244-a391-4ab5-98f1-f2d3f690a1cb', 0.00, '[\"prod_latte\"]'),
(27, 'fea5e0e7-21d4-40d1-912e-5b07bfd1e5b2', 'ade4ffae-7248-41ba-8589-aeae57d95be7', NULL, 0.00, '[\"prod_croissant\"]'),
(28, 'a6e2c83b-13ee-406d-a497-67f42432b712', 'ade4ffae-7248-41ba-8589-aeae57d95be7', NULL, 0.00, '[\"prod_croissant\"]'),
(29, '618e5568-1cac-436a-b3bb-520656e69ab8', 'ade4ffae-7248-41ba-8589-aeae57d95be7', NULL, 0.00, '[\"prod_croissant\"]'),
(30, '2012bdd6-d79f-4b12-9ce6-be80f67b7877', 'ade4ffae-7248-41ba-8589-aeae57d95be7', NULL, 0.00, '[\"prod_croissant\"]'),
(31, '1b779d21-cd56-472b-86fd-2c80145bd545', 'ade4ffae-7248-41ba-8589-aeae57d95be7', NULL, 0.00, '[\"prod_croissant\"]'),
(32, 'b13ee6de-3802-4d47-8495-f08992c25897', 'ade4ffae-7248-41ba-8589-aeae57d95be7', NULL, 0.00, '[\"prod_croissant\"]'),
(33, '597a69d8-d864-44ae-9da4-ec5011d43c54', 'ade4ffae-7248-41ba-8589-aeae57d95be7', NULL, 0.00, '[\"prod_croissant\"]'),
(34, 'b77c1da7-f87e-4411-bcd7-884119ada0ee', 'ade4ffae-7248-41ba-8589-aeae57d95be7', '2a6d754c-abfb-41d6-b320-2b4167cfdc7e', 0.00, '[\"prod_croissant\"]'),
(35, 'ec271ad3-549b-42b0-b563-b4e752d5f024', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', NULL, 0.00, '[\"prod_latte\"]'),
(36, '39ddff3b-a20f-490e-8cd1-6ab1f78f61d9', 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', NULL, 0.00, '[\"prod_latte\"]'),
(37, '0e7bbc63-b1cc-4082-9307-5d7b6d755201', 'reward_bogo_sandwich', NULL, 0.00, '[\"prod_chicken_sandwich\",\"prod_latte\"]'),
(38, 'dc88b08d-d742-4119-b2bb-890ab639cd1b', 'ade4ffae-7248-41ba-8589-aeae57d95be7', '2595d5c0-68d0-43aa-8dbe-11093df33c2b', 0.00, '[\"prod_croissant\"]');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `product_id` varchar(255) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `base_price` decimal(8,2) NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `category_id` int(11) NOT NULL,
  `availability` enum('available','unavailable') DEFAULT 'available',
  `tags` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`product_id`, `name`, `description`, `base_price`, `image_url`, `category_id`, `availability`, `tags`, `created_at`, `updated_at`) VALUES
('prod_cappuccino', 'Cappuccino', 'Espresso with steamed milk and a generous cap of foam.', 4.25, '/uploads/image-1747815131248-273303247.png', 1, 'available', '[\"coffee\",\" hot\",\" milk\"]', '2025-05-21 07:45:00', '2025-05-21 08:12:11'),
('prod_chicken_sandwich', 'Chicken Club Sandwich', 'Grilled chicken, bacon, lettuce, tomato, and mayo on toasted bread.', 8.50, '/uploads/image-1747815257345-474882815.webp', 3, 'available', '[\"sandwich\",\" lunch\"]', '2025-05-21 07:35:00', '2025-05-21 08:14:17'),
('prod_croissant', 'Butter Croissant', 'Flaky, buttery pastry, perfect with coffee.', 3.00, '/uploads/image-1747815250527-955584959.webp', 2, 'available', '[\"pastry\",\" baked\"]', '2025-05-21 07:30:00', '2025-05-21 08:14:10'),
('prod_espresso', 'Espresso', 'Rich, concentrated coffee shot.', 2.50, '/uploads/image-1747815399528-850278298.webp', 1, 'available', '[\"coffee\",\" hot\"]', '2025-05-21 07:20:00', '2025-05-21 08:16:39'),
('prod_iced_tea', 'Iced Tea (Lemon)', 'Refreshing iced tea with a hint of lemon.', 3.50, '/uploads/image-1747815533517-682608134.webp', 4, 'available', '[\"beverage\",\" cold\"]', '2025-05-21 07:40:00', '2025-05-22 06:18:31'),
('prod_latte', 'Cafe Latte', 'Smooth espresso with steamed milk and a thin layer of foam.', 4.00, '/uploads/image-1747815092094-77754804.jpg', 1, 'available', '[\"coffee\",\" hot\",\" milk\"]', '2025-05-21 07:25:00', '2025-05-21 08:11:32');

-- --------------------------------------------------------

--
-- Table structure for table `product_optiongroups`
--

CREATE TABLE `product_optiongroups` (
  `product_id` varchar(255) NOT NULL,
  `option_group_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `product_optiongroups`
--

INSERT INTO `product_optiongroups` (`product_id`, `option_group_id`) VALUES
('prod_cappuccino', 1),
('prod_cappuccino', 2),
('prod_cappuccino', 3),
('prod_espresso', 1),
('prod_latte', 1),
('prod_latte', 2);

-- --------------------------------------------------------

--
-- Table structure for table `rewards`
--

CREATE TABLE `rewards` (
  `reward_id` varchar(255) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `type` enum('standard','voucher','discount_coupon','loyalty_tier_perk','manual_grant') NOT NULL,
  `criteria_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`criteria_json`)),
  `points_cost` int(11) DEFAULT NULL,
  `discount_percentage` decimal(5,2) DEFAULT NULL,
  `discount_fixed_amount` decimal(10,2) DEFAULT NULL,
  `earning_hint` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `rewards`
--

INSERT INTO `rewards` (`reward_id`, `name`, `description`, `image_url`, `type`, `criteria_json`, `points_cost`, `discount_percentage`, `discount_fixed_amount`, `earning_hint`, `created_at`, `updated_at`) VALUES
('a4fc2305-9a0e-4e5b-8b3d-96fdf542d5d8', 'January Reward', 'coool', '/uploads/image-1748240018737-385410451.jpg', 'voucher', '{\"minSpend\":1,\"minPoints\":0,\"minPurchasesMonthly\":1,\"minReferrals\":1,\"cumulativeSpendTotal\":1,\"minSpendPerTransaction\":1,\"requiredProductIds\":[\"prod_croissant\"],\"excludedProductIds\":[\"prod_latte\"],\"requiresSpecificProductIds\":[\"prod_croissant\"],\"allowedDaysOfWeek\":[1,2,3],\"requiredCustomerTier\":[\"Bronze\"]}', 100, 10.00, 1.00, 'get 100 points bruh', '2025-05-26 06:13:38', '2025-05-26 17:54:05'),
('ade4ffae-7248-41ba-8589-aeae57d95be7', 'Face', 'test', '/uploads/image-1748567599228-687089592.jpg', 'voucher', '{\"requiresSpecificProductIds\":[\"prod_croissant\"],\"requiresProductCategory\":\"Test\"}', NULL, NULL, NULL, 'test', '2025-05-30 01:13:19', '2025-05-30 05:15:49'),
('b8d1e490-4109-45ea-b2da-dd45d8eaeefa', 'Coffee Add-on for Croissant', 'Pump up your croissant!', '/uploads/image-1747852683650-638578905.jpg', 'voucher', '{\"minSpend\":0,\"requiredProductIds\":[\"prod_croissant\"]}', NULL, NULL, NULL, 'Buy a croissant for the coffee', '2025-05-21 09:10:34', '2025-05-21 18:38:03'),
('reward_10_percent_off', '10% Off Your Next Order', 'Get 10% off your entire next order!', '/uploads/image-1747842957635-333894265.jpg', 'discount_coupon', '{\"minSpend\":25}', 150, 10.00, NULL, 'Spend at least $25 to activate this discount.', '2025-05-21 07:05:00', '2025-05-21 15:55:57'),
('reward_bogo_sandwich', 'Buy One Get One Sandwich', 'Buy any sandwich and get another one free!', '/uploads/image-1747818397819-395220489.jpg', 'standard', '{\"applicableCategory\": \"Sandwiches\"}', 200, NULL, NULL, 'Redeem 200 points for this offer. Applicable to sandwiches only.', '2025-05-21 07:15:00', '2025-05-21 09:06:37'),
('reward_free_coffee', 'Free Medium Brewed Coffee', 'Enjoy a complimentary medium brewed coffee on us!', '/uploads/image-1747817257666-764338193.jpg', 'standard', '{\"minPoints\":100}', 100, NULL, NULL, 'Accumulate 100 loyalty points to claim this reward.', '2025-05-21 07:00:00', '2025-05-21 08:47:37');

-- --------------------------------------------------------

--
-- Table structure for table `reward_freemenuitems`
--

CREATE TABLE `reward_freemenuitems` (
  `reward_id` varchar(255) NOT NULL,
  `product_id` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reward_freemenuitems`
--

INSERT INTO `reward_freemenuitems` (`reward_id`, `product_id`) VALUES
('a4fc2305-9a0e-4e5b-8b3d-96fdf542d5d8', 'prod_latte'),
('ade4ffae-7248-41ba-8589-aeae57d95be7', 'prod_croissant'),
('b8d1e490-4109-45ea-b2da-dd45d8eaeefa', 'prod_latte'),
('reward_bogo_sandwich', 'prod_chicken_sandwich'),
('reward_bogo_sandwich', 'prod_latte'),
('reward_free_coffee', 'prod_espresso');

-- --------------------------------------------------------

--
-- Table structure for table `reward_usage`
--

CREATE TABLE `reward_usage` (
  `id` int(11) NOT NULL,
  `reward_id` varchar(255) NOT NULL,
  `order_id` varchar(255) NOT NULL,
  `user_id` int(11) NOT NULL,
  `usage_type` enum('discount','free_items','other') NOT NULL,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `free_items_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`free_items_json`)),
  `used_date` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reward_usage`
--

INSERT INTO `reward_usage` (`id`, `reward_id`, `order_id`, `user_id`, `usage_type`, `discount_amount`, `free_items_json`, `used_date`) VALUES
(1, 'reward_free_coffee', 'order_004', 4, 'free_items', 0.00, '[{\"product_id\": \"prod_espresso\", \"quantity\": 1, \"product_name_snapshot\": \"Espresso\"}]', '2025-05-21 08:16:00'),
(3, 'reward_10_percent_off', 'order_006', 5, 'discount', 2.50, NULL, '2025-05-21 09:00:00'),
(5, 'b8d1e490-4109-45ea-b2da-dd45d8eaeefa', 'ORD1748450095978901', 10, 'free_items', 0.00, '{\"voucherId\":\"4f4dd244-a391-4ab5-98f1-f2d3f690a1cb\",\"freeItems\":[\"prod_latte\"]}', '2025-05-28 16:34:55');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `name` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('manager','employee','cashier','cook','customer') NOT NULL DEFAULT 'customer',
  `avatar_url` varchar(255) DEFAULT NULL,
  `loyalty_points` int(11) DEFAULT 0,
  `birth_date` date DEFAULT NULL,
  `purchases_this_month` int(11) DEFAULT 0,
  `lifetime_total_spend` decimal(10,2) DEFAULT 0.00,
  `lifetime_total_visits` int(11) DEFAULT 0,
  `membership_tier` varchar(50) DEFAULT NULL,
  `tier_join_date` date DEFAULT NULL,
  `join_date` datetime DEFAULT current_timestamp(),
  `phone_number` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `referral_code` varchar(20) DEFAULT NULL,
  `referrals_made` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `email`, `name`, `password_hash`, `role`, `avatar_url`, `loyalty_points`, `birth_date`, `purchases_this_month`, `lifetime_total_spend`, `lifetime_total_visits`, `membership_tier`, `tier_join_date`, `join_date`, `phone_number`, `address`, `referral_code`, `referrals_made`, `created_at`, `updated_at`) VALUES
(1, 'manager@espressolane.com', 'Alice Smith', '$2b$10$xVVVYrxnOGOdBytrmIINBuA0QurtDmpAJk3OnK5/fyvVKyjsr.ohu', 'manager', '/uploads/image-1747854131716-110370109.png', 99549, '1985-03-15', 0, 0.00, 0, NULL, '2025-05-31', '2024-01-10 10:00:00', '09171234567', '123 Coffee St, Legazpi City', 'ALICESMITH', 5, '2024-01-10 10:00:00', '2025-05-30 18:08:50'),
(2, 'cashier@espressolane.com', 'Bob Johnson', '$2b$10$IxCOr822M9w6myeeGYESD.Fa2.ceVLq78YVtGFNf8yCLT.ARoiALO', 'cashier', '/uploads/image-1747850222970-820065253.png', 0, '1990-07-22', 0, 0.00, 0, NULL, NULL, '2024-02-01 09:00:00', '09187654321', '456 Latte Ave, Legazpi City', NULL, 0, '2024-02-01 09:00:00', '2025-05-22 02:45:59'),
(3, 'cook@espressolane.com', 'Charlie Brown', '$2b$10$xVVVYrxnOGOdBytrmIINBuA0QurtDmpAJk3OnK5/fyvVKyjsr.ohu', 'cook', '/uploads/image-1747850253639-5932906.png', 0, '1992-11-05', 0, 0.00, 0, NULL, NULL, '2024-03-15 08:30:00', '09191122334', '789 Croissant Rd, Legazpi City', NULL, 0, '2024-03-15 08:30:00', '2025-05-21 17:57:33'),
(4, 'customer1@example.com', 'Diana Prince', '$2b$10$xVVVYrxnOGOdBytrmIINBuA0QurtDmpAJk3OnK5/fyvVKyjsr.ohu', 'customer', '/uploads/avatar-diana.jpg', 0, '1995-01-01', 3, 125.50, 8, 'Gold', '2025-01-20', '2024-04-01 11:00:00', '09205556677', '101 Wonder Ln, Legazpi City', 'DIANAPRINCE', 2, '2024-04-01 11:00:00', '2025-05-22 04:43:58'),
(5, 'customer2@example.com', 'Clark Kent', '$2b$10$xVVVYrxnOGOdBytrmIINBuA0QurtDmpAJk3OnK5/fyvVKyjsr.ohu', 'customer', '/uploads/avatar-clark.jpg', 50, '1988-06-25', 1, 45.00, 3, 'Silver', '2025-03-10', '2024-05-10 14:00:00', '09219988776', '202 Krypton St, Legazpi City', NULL, 0, '2024-05-10 14:00:00', '2025-05-21 16:33:08'),
(6, 'customer3@example.com', 'Bruce Wayne', '$2b$10$xVVVYrxnOGOdBytrmIINBuA0QurtDmpAJk3OnK5/fyvVKyjsr.ohu', 'customer', '/uploads/avatar-bruce.jpg', 25, '1970-04-12', 0, 20.00, 1, 'Bronze', '2025-04-05', '2024-06-01 16:00:00', '09223344556', '303 Batcave Dr, Legazpi City', 'BRUCEWAYNE', 0, '2024-06-01 16:00:00', '2025-05-21 16:33:04'),
(7, 'rick@morty.com', 'Rick Morty', '$2b$10$xVVVYrxnOGOdBytrmIINBuA0QurtDmpAJk3OnK5/fyvVKyjsr.ohu', 'customer', '/src/assets/avatar.png', 0, NULL, 0, 0.00, 0, 'bronze', '2025-05-30', '2025-05-22 00:27:33', '1234-567-8912', 'Test Avenue', '7A9E508F', 0, '2025-05-21 16:27:33', '2025-05-30 13:24:03'),
(8, 'qwert@qwer', 'qwert', '$2b$10$g39dNMgqF.azkeCeAh.B6uGKDQ.EM5k1Y8S8JFAMNKhofQcRKLcvC', 'customer', '/src/assets/avatar.png', 0, NULL, 0, 0.00, 0, NULL, NULL, '2025-05-22 14:19:09', NULL, NULL, '4B468B4F', 0, '2025-05-22 06:19:09', '2025-05-22 06:19:09'),
(9, 'test@user.com', 'Test User', '$2b$10$UYSq1UaALoZ0Axcq4vHK7eLXUddp6/2mUJfKTylugMrsbVJtHh11a', 'customer', '/src/assets/avatar.png', 148, NULL, 0, 0.00, 0, NULL, '2025-05-31', '2025-05-28 09:49:12', '1234-567-8911', 'Test23', '6B252BCD', 0, '2025-05-28 01:49:12', '2025-05-31 10:08:38'),
(10, 'test3@user.com', 'Test2 User', '$2b$10$EYU9aFLKwUy8a/jGPSnU/e/vX/bQrz5ETqpwzLL9IrQI.UCZZHbru', 'customer', '/src/assets/avatar.png', 0, NULL, 0, 0.00, 0, NULL, NULL, '2025-05-28 11:45:27', NULL, NULL, '83C27165', 0, '2025-05-28 03:45:27', '2025-05-28 03:45:27'),
(11, 'test4@user.com', 'TEst', '$2b$10$uSo98t8Nk3TRTXQTHAZFLe9Ng4EPd3JhzCp5C4mM/1CMRi0a2Q3cm', 'customer', '/src/assets/avatar.png', 0, NULL, 0, 0.00, 0, NULL, NULL, '2025-05-30 00:17:18', NULL, NULL, 'CBDECC6B', 0, '2025-05-29 16:17:18', '2025-05-29 16:17:18'),
(12, 'buy@one.com', 'Buy One Get One Sandwich', '$2b$10$8rbEPa4reUWK53RXp8bwhe2rvaS0QJjJLSFtPEBdSr.bwqTMB5g8m', 'customer', '/src/assets/avatar.png', 0, NULL, 0, 0.00, 0, NULL, NULL, '2025-05-30 18:01:18', NULL, NULL, '4C51A835', 0, '2025-05-30 10:01:18', '2025-05-30 10:01:18');

-- --------------------------------------------------------

--
-- Table structure for table `usersettings`
--

CREATE TABLE `usersettings` (
  `user_id` int(11) NOT NULL,
  `settings_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`settings_json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `usersettings`
--

INSERT INTO `usersettings` (`user_id`, `settings_json`) VALUES
(4, '{\"theme\": \"dark\", \"notifications\": {\"email\": true, \"sms\": false}}'),
(5, '{\"theme\": \"light\", \"notifications\": {\"email\": false, \"sms\": true}}'),
(6, '{\"theme\": \"system\", \"notifications\": {\"email\": true, \"sms\": true}}'),
(7, '{\"autoSave\":false,\"theme\":\"light\",\"profileBanner\":{\"type\":\"image\",\"value\":\"/uploads/image-1748302275869-924262383.jpg\"}}'),
(10, '{\"autoSave\":false,\"theme\":\"light\",\"profileBanner\":{\"type\":\"color\",\"value\":\"#7c8380\"}}');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`category_id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `customervouchers`
--
ALTER TABLE `customervouchers`
  ADD PRIMARY KEY (`voucher_instance_id`),
  ADD KEY `reward_id` (`reward_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `employee_grant_user_id` (`employee_grant_user_id`),
  ADD KEY `fk_customervouchers_order` (`order_id`);

--
-- Indexes for table `customer_claimed_rewards`
--
ALTER TABLE `customer_claimed_rewards`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_customer_reward` (`customer_id`,`reward_id`),
  ADD KEY `reward_id` (`reward_id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indexes for table `employeedetails`
--
ALTER TABLE `employeedetails`
  ADD PRIMARY KEY (`employee_internal_id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD UNIQUE KEY `employee_id_code` (`employee_id_code`);

--
-- Indexes for table `loyalty_points_transactions`
--
ALTER TABLE `loyalty_points_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `reward_id` (`reward_id`);

--
-- Indexes for table `membershiptransactions`
--
ALTER TABLE `membershiptransactions`
  ADD PRIMARY KEY (`transaction_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `optiongroups`
--
ALTER TABLE `optiongroups`
  ADD PRIMARY KEY (`option_group_id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `options`
--
ALTER TABLE `options`
  ADD PRIMARY KEY (`option_id`),
  ADD KEY `option_group_id` (`option_group_id`);

--
-- Indexes for table `orderlineitems`
--
ALTER TABLE `orderlineitems`
  ADD PRIMARY KEY (`order_line_item_id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `fk_orderlineitems_reward` (`reward_id`);

--
-- Indexes for table `orderlineitem_selectedoptions`
--
ALTER TABLE `orderlineitem_selectedoptions`
  ADD PRIMARY KEY (`order_line_item_id`,`option_id`),
  ADD KEY `option_id` (`option_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`order_id`),
  ADD UNIQUE KEY `ticket_number` (`ticket_number`),
  ADD KEY `customer_id` (`customer_id`);

--
-- Indexes for table `order_rewards`
--
ALTER TABLE `order_rewards`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `reward_id` (`reward_id`),
  ADD KEY `voucher_id` (`voucher_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`product_id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `product_optiongroups`
--
ALTER TABLE `product_optiongroups`
  ADD PRIMARY KEY (`product_id`,`option_group_id`),
  ADD KEY `option_group_id` (`option_group_id`);

--
-- Indexes for table `rewards`
--
ALTER TABLE `rewards`
  ADD PRIMARY KEY (`reward_id`);

--
-- Indexes for table `reward_freemenuitems`
--
ALTER TABLE `reward_freemenuitems`
  ADD PRIMARY KEY (`reward_id`,`product_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `reward_usage`
--
ALTER TABLE `reward_usage`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reward_id` (`reward_id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `referral_code` (`referral_code`),
  ADD KEY `idx_email` (`email`);

--
-- Indexes for table `usersettings`
--
ALTER TABLE `usersettings`
  ADD PRIMARY KEY (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `category_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `customer_claimed_rewards`
--
ALTER TABLE `customer_claimed_rewards`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `employeedetails`
--
ALTER TABLE `employeedetails`
  MODIFY `employee_internal_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `loyalty_points_transactions`
--
ALTER TABLE `loyalty_points_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `membershiptransactions`
--
ALTER TABLE `membershiptransactions`
  MODIFY `transaction_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=54;

--
-- AUTO_INCREMENT for table `optiongroups`
--
ALTER TABLE `optiongroups`
  MODIFY `option_group_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `options`
--
ALTER TABLE `options`
  MODIFY `option_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `orderlineitems`
--
ALTER TABLE `orderlineitems`
  MODIFY `order_line_item_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=89;

--
-- AUTO_INCREMENT for table `order_rewards`
--
ALTER TABLE `order_rewards`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `reward_usage`
--
ALTER TABLE `reward_usage`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `customervouchers`
--
ALTER TABLE `customervouchers`
  ADD CONSTRAINT `customervouchers_ibfk_1` FOREIGN KEY (`reward_id`) REFERENCES `rewards` (`reward_id`),
  ADD CONSTRAINT `customervouchers_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `customervouchers_ibfk_3` FOREIGN KEY (`employee_grant_user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `customer_claimed_rewards`
--
ALTER TABLE `customer_claimed_rewards`
  ADD CONSTRAINT `customer_claimed_rewards_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `customer_claimed_rewards_ibfk_2` FOREIGN KEY (`reward_id`) REFERENCES `rewards` (`reward_id`);

--
-- Constraints for table `employeedetails`
--
ALTER TABLE `employeedetails`
  ADD CONSTRAINT `employeedetails_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `loyalty_points_transactions`
--
ALTER TABLE `loyalty_points_transactions`
  ADD CONSTRAINT `loyalty_points_transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `loyalty_points_transactions_ibfk_3` FOREIGN KEY (`reward_id`) REFERENCES `rewards` (`reward_id`);

--
-- Constraints for table `membershiptransactions`
--
ALTER TABLE `membershiptransactions`
  ADD CONSTRAINT `membership_transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `options`
--
ALTER TABLE `options`
  ADD CONSTRAINT `options_ibfk_1` FOREIGN KEY (`option_group_id`) REFERENCES `optiongroups` (`option_group_id`) ON DELETE CASCADE;

--
-- Constraints for table `orderlineitems`
--
ALTER TABLE `orderlineitems`
  ADD CONSTRAINT `fk_orderlineitems_reward` FOREIGN KEY (`reward_id`) REFERENCES `rewards` (`reward_id`),
  ADD CONSTRAINT `orderlineitems_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `orderlineitems_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`);

--
-- Constraints for table `orderlineitem_selectedoptions`
--
ALTER TABLE `orderlineitem_selectedoptions`
  ADD CONSTRAINT `orderlineitem_selectedoptions_ibfk_1` FOREIGN KEY (`order_line_item_id`) REFERENCES `orderlineitems` (`order_line_item_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `orderlineitem_selectedoptions_ibfk_2` FOREIGN KEY (`option_id`) REFERENCES `options` (`option_id`);

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `order_rewards`
--
ALTER TABLE `order_rewards`
  ADD CONSTRAINT `order_rewards_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `order_rewards_ibfk_2` FOREIGN KEY (`reward_id`) REFERENCES `rewards` (`reward_id`),
  ADD CONSTRAINT `order_rewards_ibfk_3` FOREIGN KEY (`voucher_id`) REFERENCES `customervouchers` (`voucher_instance_id`);

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`);

--
-- Constraints for table `product_optiongroups`
--
ALTER TABLE `product_optiongroups`
  ADD CONSTRAINT `product_optiongroups_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `product_optiongroups_ibfk_2` FOREIGN KEY (`option_group_id`) REFERENCES `optiongroups` (`option_group_id`) ON DELETE CASCADE;

--
-- Constraints for table `reward_freemenuitems`
--
ALTER TABLE `reward_freemenuitems`
  ADD CONSTRAINT `reward_freemenuitems_ibfk_1` FOREIGN KEY (`reward_id`) REFERENCES `rewards` (`reward_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `reward_freemenuitems_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE;

--
-- Constraints for table `reward_usage`
--
ALTER TABLE `reward_usage`
  ADD CONSTRAINT `reward_usage_ibfk_1` FOREIGN KEY (`reward_id`) REFERENCES `rewards` (`reward_id`),
  ADD CONSTRAINT `reward_usage_ibfk_2` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`),
  ADD CONSTRAINT `reward_usage_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `usersettings`
--
ALTER TABLE `usersettings`
  ADD CONSTRAINT `usersettings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
